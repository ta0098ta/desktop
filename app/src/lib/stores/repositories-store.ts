import * as Path from 'path'
import {
  RepositoriesDatabase,
  IDatabaseGitHubRepository,
} from '../databases/repositories-database'
import { Owner } from '../../models/owner'
import { IRepositoryAPIResult } from '../api'
import { BaseStore } from './base-store'
import {
  GHDatabase,
  IRepository,
  Collections,
  toRepositoryModel,
} from '../../database'
import { fatalError } from '../fatal-error'

/** The store for local repositories. */
export class RepositoriesStore extends BaseStore {
  private db: RepositoriesDatabase
  private ghDb: GHDatabase

  public constructor(db: RepositoriesDatabase, ghDB: GHDatabase) {
    super()

    this.db = db
    this.ghDb = ghDB
  }

  public async addParentGHRepository(
    repository: IRepository,
    endpoint: string,
    head: IRepositoryAPIResult,
    base: IRepositoryAPIResult
  ): Promise<void> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    const document = collection.findOne({
      name: repository.name,
      path: repository.path,
    })

    if (document === null) {
      return fatalError('Repository not found')
    }

    if (document.ghRepository == null) {
      return fatalError("Cannot add base repo when gh repo doesn't exist")
    }

    await collection.findAndUpdate(
      {
        name: repository.name,
        path: repository.path,
      },
      r => ({
        kind: 'repository',
        ...r,
        ghRepository: {
          ...this.createGHRepository(r, head, endpoint),
          parent: this.createGHRepository(r, base, endpoint),
        },
      })
    )

    await this.ghDb.save()
    this.emitUpdate()
  }

  /** Find the matching GitHub repository or add it if it doesn't exist. */
  public async upsertGitHubRepository(
    repository: IRepository,
    endpoint: string,
    apiResult: IRepositoryAPIResult
  ): Promise<IRepository> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    const document = collection.findOne({
      name: repository.name,
      path: repository.path,
    })

    if (document === null) {
      return fatalError('Repository not found')
    }

    if (document.ghRepository != null) {
      return document.ghRepository
    } else {
      await collection.findAndUpdate(
        {
          name: repository.name,
          path: repository.path,
        },
        r => ({
          ...r,
          ghRepository: this.createGHRepository(r, apiResult, endpoint),
        })
      )

      await this.ghDb.save()

      const repo = await collection.findOne({
        name: repository.name,
        path: repository.path,
      })

      if (repo === null) {
        return fatalError('Write failed.')
      }

      this.emitUpdate()
      return toRepositoryModel(repo).ghRepository!
    }
  }

  public async addGHRepository(
    repository: IRepository,
    endpoint: string,
    apiResult: IRepositoryAPIResult
  ) {
    const collection = this.ghDb.getCollection(Collections.Repository)
    await collection.findAndUpdate(
      {
        name: repository.name,
        path: repository.path,
      },
      r => ({
        ...r,
        ghRepository: this.createGHRepository(r, apiResult, endpoint),
      })
    )
    await this.ghDb.save()
  }

  private createGHRepository(
    repository: IRepository,
    apiResult: IRepositoryAPIResult,
    endpoint?: string
  ): IRepository {
    const ghRepo: IRepository = {
      kind: 'gh-repository',
      name: apiResult.name,
      defaultBranch: apiResult.default_branch,
      isPrivate: apiResult.private,
      cloneUrl: apiResult.clone_url,
      htmlUrl: apiResult.html_url,
      owner: {
        name: apiResult.owner.name,
        login: apiResult.owner.login,
        email: apiResult.owner.email,
        endpoint: endpoint || '', // what is endpoint?
        avatarUrl: apiResult.owner.avatar_url,
      },
      parent:
        apiResult.parent &&
        this.createGHRepository(repository, apiResult.parent), // where do forked repos get their endpoint from
      issues: [],
      mentionables: [],
      pullRequests: [],
    }

    return ghRepo
  }

  private async buildGitHubRepository(
    dbRepo: IDatabaseGitHubRepository
  ): Promise<IRepository> {
    const owner = await this.db.owners.get(dbRepo.ownerID)

    if (owner == null) {
      throw new Error(`Couldn't find the owner for ${dbRepo.name}`)
    }

    let parent: IRepository | null = null
    if (dbRepo.parentID) {
      parent = await this.findGitHubRepositoryByID(dbRepo.parentID)
    }

    return new IGHRepository(
      dbRepo.name,
      new Owner(owner.login, owner.endpoint, owner.id!),
      dbRepo.id!,
      dbRepo.private,
      dbRepo.htmlURL,
      dbRepo.defaultBranch,
      dbRepo.cloneURL,
      parent
    )
  }

  /** Find a GitHub repository by its DB ID. */
  public async findGitHubRepositoryByID(
    id: number
  ): Promise<IRepository | null> {
    const gitHubRepository = await this.db.gitHubRepositories.get(id)
    if (!gitHubRepository) {
      return null
    }

    return this.buildGitHubRepository(gitHubRepository)
  }

  /** Get all the local repositories. */
  public async getAll(): Promise<ReadonlyArray<IRepository>> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    const repos = collection.find().map(r => toRepositoryModel(r))

    return repos
  }

  /**
   * Add a new local repository.
   *
   * If a repository already exists with that path, it will be returned instead.
   */
  public async addRepository(path: string): Promise<IRepository> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    const repo = collection.findOne({ path })

    if (repo != null) {
      return toRepositoryModel(repo)
    }

    const document = await collection.insertOne({
      path,
      kind: 'repository',
      name: Path.basename(path),
      isMissing: false,
    })

    if (document === undefined) {
      throw new Error('Write failed')
    }

    await this.ghDb.save()
    this.emitUpdate()

    return toRepositoryModel(document)
  }

  /** Update the repository's `missing` flag. */
  public async updateRepositoryMissing(
    repository: IRepository,
    missing: boolean
  ): Promise<IRepository> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    collection.findAndUpdate(
      { name: repository.name, path: repository.path },
      r => ({
        ...r,
        isMissing: missing,
      })
    )

    const updatedRepo: IRepository = {
      ...repository,
      isMissing: missing,
    }

    this.ghDb.save()
    this.emitUpdate()

    return updatedRepo
  }

  /** Update the repository's path. */
  public async updateRepositoryPath(
    repository: IRepository,
    path: string
  ): Promise<IRepository> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    collection.findAndUpdate(
      { name: repository.name, path: repository.path },
      r => ({
        ...r,
        path,
      })
    )

    const newRepo: IRepository = {
      ...repository,
      path,
      isMissing: false,
    }

    this.ghDb.save()
    this.emitUpdate()

    return newRepo
  }

  /** Add or update the repository's GitHub repository. */
  public async updateGitHubRepository(
    repository: IRepository,
    endpoint: string,
    apiResult: IRepositoryAPIResult
  ): Promise<IRepository> {
    const collection = this.ghDb.getCollection(Collections.Repository)
    collection.findAndUpdate(
      { name: repository.name, path: repository.path },
      r => ({
        ...r,
        ghRepository: this.createGHRepository(repository, apiResult, endpoint),
      })
    )

    const newRepo: IRepository = {
      ...repository,
      ghRepository: this.createGHRepository(repository, apiResult, endpoint),
    }

    this.ghDb.save()
    this.emitUpdate()

    return newRepo
  }
}
