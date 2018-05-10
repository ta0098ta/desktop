import { IssuesDatabase, IIssue } from '../databases/issues-database'
import { API, IAPIIssue } from '../api'
import { Account } from '../../models/account'
import { forceUnwrap } from '../fatal-error'
import { GHDatabase, IRepository } from '../../database'

/** The hard limit on the number of issue results we'd ever return. */
const IssueResultsHardLimit = 100

/** The store for GitHub issues. */
export class IssuesStore {
  private db: IssuesDatabase
  private ghDb: GHDatabase

  /** Initialize the store with the given database. */
  public constructor(db: IssuesDatabase, ghDb: GHDatabase) {
    this.db = db
    this.ghDb = ghDb
  }

  /**
   * Get the highest value of the 'updated_at' field for issues in a given
   * repository. This value is used to request delta updates from the API
   * using the 'since' parameter.
   */
  private async getLatestUpdatedAt(
    repository: IRepository
  ): Promise<Date | null> {
    const ghRepo = forceUnwrap(
      'Cannot access issues on non gh repo',
      repository.ghRepository
    )
    //sorted so latest date is first
    const issues = [...ghRepo.issues].sort(
      (a, b) => (a.updatedAt > b.updatedAt ? -1 : 1)
    )
    const lastUpdatedAt = new Date(issues[0].updatedAt)

    return !isNaN(lastUpdatedAt.getTime()) ? lastUpdatedAt : null
  }

  /**
   * Refresh the issues for the current repository. This will delete any issues that have
   * been closed and update or add any issues that have changed or been added.
   */
  public async refreshIssues(repository: IRepository, account: Account) {
    const api = API.fromAccount(account)
    const lastUpdatedAt = await this.getLatestUpdatedAt(repository)

    // If we don't have a lastUpdatedAt that mean we haven't fetched any issues
    // for the repository yet which in turn means we only have to fetch the
    // currently open issues. If we have fetched before we get all issues
    // that have been modified since the last time we fetched so that we
    // can prune closed issues from our database. Note that since the GitHub
    // API returns all issues modified _at_ or after the timestamp we give it
    // we will always get at least one issue back but we won't have to transfer
    // it since we should get a 304 response from GitHub.
    const state = lastUpdatedAt ? 'all' : 'open'

    const issues = await api.fetchIssues(
      repository.owner.login,
      repository.name,
      state,
      lastUpdatedAt
    )

    this.storeIssues(issues, repository)
  }

  private async storeIssues(
    issues: ReadonlyArray<IAPIIssue>,
    repository: IRepository
  ): Promise<void> {
    const issuesToDelete = issues.filter(i => i.state === 'closed')
    const issuesToUpsert = issues
      .filter(i => i.state === 'open')
      .map<IIssue>(i => {
        return {
          number: i.number,
          title: i.title,
          updated_at: i.updated_at,
        }
      })

    const db = this.db

    function findIssueInRepositoryByNumber(
      gitHubRepositoryID: number,
      issueNumber: number
    ) {
      return db.issues
        .where('[gitHubRepositoryID+number]')
        .equals([gitHubRepositoryID, issueNumber])
        .limit(1)
        .first()
    }

    await this.db.transaction('rw', this.db.issues, async () => {
      for (const issue of issuesToDelete) {
        const existing = await findIssueInRepositoryByNumber(
          gitHubRepositoryID,
          issue.number
        )
        if (existing) {
          await this.db.issues.delete(existing.id!)
        }
      }

      for (const issue of issuesToUpsert) {
        const existing = await findIssueInRepositoryByNumber(
          gitHubRepositoryID,
          issue.number
        )
        if (existing) {
          await db.issues.update(existing.id!, issue)
        } else {
          await db.issues.add(issue)
        }
      }
    })
  }

  /** Get issues whose title or number matches the text. */
  public getIssuesMatching(
    repository: IRepository,
    text: string
  ): ReadonlyArray<IIssue> {
    const sortedIssues = [...repository.issues].sort(
      (a, b) => (a.number < b.number ? -1 : 1)
    )

    if (text.length === 0) {
      return sortedIssues
    }

    const MaxScore = 1
    const score = (i: IIssue) => {
      if (i.number.toString().startsWith(text)) {
        return MaxScore
      }

      if (i.title.toLowerCase().includes(text.toLowerCase())) {
        return MaxScore - 0.1
      }

      return 0
    }

    const filteredIssues = sortedIssues.filter(issue => score(issue) > 0)

    return filteredIssues
  }
}
