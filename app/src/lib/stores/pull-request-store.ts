import { PullRequestDatabase } from '../databases'
import { Account } from '../../models/account'
import { API, IPullRequestAPIResult } from '../api'
import { fatalError, forceUnwrap } from '../fatal-error'
import { RepositoriesStore } from './repositories-store'
import {
  PullRequest,
  PullRequestRef,
  PullRequestStatus,
} from '../../models/pull-request'
import { TypedBaseStore } from './base-store'
import { getRemotes, removeRemote } from '../git'
import { IRemote, ForkedRemotePrefix } from '../../models/remote'
import {
  getFullName,
  getEndpoint,
  IPullRequest,
  IPullRequestStatus,
  GHDatabase,
  Collections,
  IRepository,
} from '../../database'

const Decrement = (n: number) => n - 1
const Increment = (n: number) => n + 1

/** The store for GitHub Pull Requests. */
export class PullRequestStore extends TypedBaseStore<IRepository> {
  private readonly pullRequestDatabase: PullRequestDatabase
  private readonly ghDb: GHDatabase
  private readonly repositoryStore: RepositoriesStore
  private readonly activeFetchCountPerRepository = new Map<string, number>()

  public constructor(
    db: PullRequestDatabase,
    ghDb: GHDatabase,
    repositoriesStore: RepositoriesStore
  ) {
    super()

    this.pullRequestDatabase = db
    this.ghDb = ghDb
    this.repositoryStore = repositoriesStore
  }

  /** Loads all pull requests against the given repository. */
  public async fetchAndCachePullRequests(
    repository: IRepository,
    account: Account
  ): Promise<void> {
    const ghRepo = forceUnwrap(
      'Can only refresh pull requests for GitHub repositories',
      repository.ghRepository
    )
    const apiClient = API.fromAccount(account)

    this.updateActiveFetchCount(repository, Increment)

    try {
      const apiResult = await apiClient.fetchPullRequests(
        ghRepo.owner.login,
        ghRepo.name,
        'open'
      )

      await this.cachePullRequests(apiResult, repository)

      const prs = await this.fetchPullRequestsFromCache(repository)

      await this.fetchAndCachePullRequestStatus(prs, repository, account)
      await this.pruneForkedRemotes(repository, prs)

      this.emitUpdate(repository)
    } catch (error) {
      log.warn(`Error refreshing pull requests for '${repository.name}'`, error)
      this.emitError(error)
    } finally {
      this.updateActiveFetchCount(repository, Decrement)
    }
  }

  /** Is the store currently fetching the list of open pull requests? */
  public isFetchingPullRequests(repository: IRepository): boolean {
    const key = this.keyOf(repository)
    return (this.activeFetchCountPerRepository.get(key) || 0) > 0
  }

  private keyOf(repository: IRepository) {
    return `${getFullName(repository)}-${repository.path}`
  }

  /** Loads the status for the given pull request. */
  public async fetchPullRequestStatus(
    repository: IRepository,
    account: Account,
    pullRequest: PullRequest
  ): Promise<void> {
    await this.fetchAndCachePullRequestStatus(
      [pullRequest],
      repository,
      account
    )
  }

  /** Loads the status for all pull request against a given repository. */
  public async fetchPullRequestStatuses(
    repository: IRepository,
    account: Account
  ): Promise<void> {
    const prs = await this.fetchPullRequestsFromCache(repository)

    await this.fetchAndCachePullRequestStatus(prs, repository, account)
  }

  /** Gets the pull requests against the given repository. */
  public async fetchPullRequestsFromCache(
    repository: IRepository
  ): Promise<ReadonlyArray<PullRequest>> {
    const gitHubRepositoryID = repository.dbID

    if (gitHubRepositoryID == null) {
      return fatalError(
        "Cannot get pull requests for a repository that hasn't been inserted into the database!"
      )
    }

    const records = await this.pullRequestDatabase.pullRequests
      .where('base.repoId')
      .equals(gitHubRepositoryID)
      .reverse()
      .sortBy('number')

    const result = new Array<PullRequest>()

    for (const record of records) {
      const repositoryDbId = record.head.repoId
      let githubRepository: GitHubRepository | null = null

      if (repositoryDbId != null) {
        githubRepository = await this.repositoryStore.findGitHubRepositoryByID(
          repositoryDbId
        )
      }

      // We know the base repo ID can't be null since it's the repository we
      // fetched the PR from in the first place.
      const parentRepositoryDbId = forceUnwrap(
        'A pull request cannot have a null base repo id',
        record.base.repoId
      )
      const parentGitGubRepository: GitHubRepository | null = await this.repositoryStore.findGitHubRepositoryByID(
        parentRepositoryDbId
      )
      const parentGitHubRepository = forceUnwrap(
        'PR cannot have a null base repo',
        parentGitGubRepository
      )

      // We can be certain the PR ID is valid since we just got it from the
      // database.
      const pullRequestDbId = forceUnwrap(
        'PR cannot have a null ID after being retrieved from the database',
        record.id
      )

      const pullRequestStatus = await this.findPullRequestStatus(
        record.head.sha,
        pullRequestDbId
      )

      result.push(
        new PullRequest(
          pullRequestDbId,
          new Date(record.createdAt),
          pullRequestStatus,
          record.title,
          record.number,
          new PullRequestRef(
            record.head.ref,
            record.head.sha,
            githubRepository
          ),
          new PullRequestRef(
            record.base.ref,
            record.base.sha,
            parentGitHubRepository
          ),
          record.author
        )
      )
    }

    return result
  }

  private async pruneForkedRemotes(
    repository: IRepository,
    pullRequests: ReadonlyArray<PullRequest>
  ) {
    const remotes = await getRemotes(repository)
    const forkedRemotesToDelete = this.getRemotesToDelete(remotes, pullRequests)

    await this.deleteRemotes(repository, forkedRemotesToDelete)
  }

  private getRemotesToDelete(
    remotes: ReadonlyArray<IRemote>,
    openPullRequests: ReadonlyArray<PullRequest>
  ): ReadonlyArray<IRemote> {
    const forkedRemotes = remotes.filter(remote =>
      remote.name.startsWith(ForkedRemotePrefix)
    )
    const remotesOfPullRequests = new Set<string>()

    openPullRequests.forEach(pr => {
      const { gitHubRepository } = pr.head

      if (gitHubRepository != null && gitHubRepository.cloneURL != null) {
        remotesOfPullRequests.add(gitHubRepository.cloneURL)
      }
    })

    const result = forkedRemotes.filter(
      forkedRemote => !remotesOfPullRequests.has(forkedRemote.url)
    )

    return result
  }

  private async deleteRemotes(
    repository: IRepository,
    remotes: ReadonlyArray<IRemote>
  ) {
    const promises: Array<Promise<void>> = []

    remotes.forEach(r => promises.push(removeRemote(repository, r.name)))
    await Promise.all(promises)
  }

  private updateActiveFetchCount(
    repository: IRepository,
    update: (count: number) => number
  ) {
    const key = this.keyOf(repository)
    const currentCount = this.activeFetchCountPerRepository.get(key) || 0
    const newCount = update(currentCount)

    this.activeFetchCountPerRepository.set(key, newCount)
    this.emitUpdate(repository)
  }

  private async fetchAndCachePullRequestStatus(
    pullRequests: ReadonlyArray<PullRequest>,
    repository: IRepository,
    account: Account
  ): Promise<void> {
    const apiClient = API.fromAccount(account)
    const statuses: Array<IPullRequestStatus> = []

    for (const pr of pullRequests) {
      const combinedRefStatus = await apiClient.fetchCombinedRefStatus(
        repository.ghRepository!.owner.login,
        repository.name,
        pr.head.sha
      )

      statuses.push({
        pullRequestId: pr.id,
        state: combinedRefStatus.state,
        totalCount: combinedRefStatus.total_count,
        sha: pr.head.sha,
        statuses: combinedRefStatus.statuses.map(s => ({
          state: s.state,
          targetUrl: s.target_url,
          description: s.description,
          context: s.context,
        })),
      })
    }

    await this.cachePullRequestStatuses(repository, statuses)
    this.emitUpdate(repository)
  }

  private async findPullRequestStatus(
    sha: string,
    pullRequestId: number
  ): Promise<PullRequestStatus | null> {
    const result = await this.pullRequestDatabase.pullRequestStatus
      .where('[sha+pullRequestId]')
      .equals([sha, pullRequestId])
      .limit(1)
      .first()

    if (!result) {
      return null
    }

    const combinedRefStatuses = (result.statuses || []).map(x => {
      return {
        id: x.id,
        state: x.state,
        description: x.description,
      }
    })

    return new PullRequestStatus(
      result.pullRequestId,
      result.state,
      result.totalCount,
      result.sha,
      combinedRefStatuses
    )
  }

  private prAPIResultToModel(apiResult: IPullRequestAPIResult): IPullRequest {
    const model: IPullRequest = {
      number: apiResult.number,
      title: apiResult.title,
      createdAt: apiResult.created_at,
      head: {
        ref: apiResult.head.ref,
        sha: apiResult.head.sha,
      },
      base: {
        ref: apiResult.base.ref,
        sha: apiResult.base.sha,
      },
      author: apiResult.user.login,
    }

    return model
  }

  private async cachePullRequests(
    repository: IRepository,
    apiResults: ReadonlyArray<IPullRequestAPIResult>
  ): Promise<void> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    await collection.findAndUpdate(
      { name: repository.name, path: repository.path },
      d => {
        const ghRepo = d.ghRepository
        return {
          ...d,
          ghRepository: {
            ...ghRepo,
            pullRequests: apiResults.map(this.prAPIResultToModel),
          },
        }
      }
    )
  }

  private async cachePullRequestStatuses(
    repository: IRepository,
    apiResults: Array<IPullRequestStatus>
  ): Promise<void> {
    if (repository.ghRepository == null) {
      return fatalError('Cannot store PRs for non gh repo')
    }

    const collection = this.ghDb.getCollection(Collections.Repository)
    await collection.findAndUpdate(
      { name: repository.name, path: repository.path },
      d => {
        const ghRepo = d.ghRepository
        return {
          ...d,
          ghRepository: {
            ...ghRepo,
            apiResults,
          },
        }
      }
    )
  }
}
