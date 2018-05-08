import * as Loki from 'lokijs'
import { assertNever } from '../fatal-error'
import { IPullRequest } from '.'

export enum Collection {
  Repositories = 'repositories',
}

export interface IRepositoryModel {
  readonly name: string
  readonly displayName?: string
  readonly path: string
  readonly ghRepository?: IGHRepositoryModel
}

interface IIssueModel {
  readonly number: number
  readonly title: string
  readonly updatedAt: Date
}

interface IUserModel {
  readonly name: string
  readonly login: string
  readonly email: string
  readonly endpoint: string
  readonly avatarUrl: string
}

interface IGHRepositoryModel {
  readonly defaultBranch: string
  readonly isPrivate: boolean
  readonly cloneUrl: string
  readonly htmlUrl: string
  readonly issues: ReadonlyArray<IIssueModel>
  readonly owner: IUserModel
  readonly forkedFrom?: IGHRepositoryModel
  readonly mentionables: ReadonlyArray<IUserModel>
  readonly pullRequests: ReadonlyArray<IPullRequest>
}

export class GHDatabase {
  private readonly db: Loki

  public constructor(path: string) {
    this.db = new Loki(path)
    this.initCollections()
  }

  public getCollection(collection: Collection) {
    switch (collection) {
      case Collection.Repositories:
        return this.db.getCollection<IRepositoryModel>(Collection.Repositories)
      default:
        return assertNever(collection, `unknown collection ${collection}`)
    }
  }

  public save() {
    this.db.save(this.onSaveError)
  }

  private initCollections() {
    if (this.db.getCollection(Collection.Repositories) == null) {
      this.db.addCollection<IRepositoryModel>(Collection.Repositories)
    }
  }

  private onSaveError = (error?: any) => {
    if (error != null) {
      log.error(error)
    }
  }
}
