import * as Loki from 'lokijs'
import { assertNever } from '../fatal-error'

export enum Collection {
  Repositories = 'repositories',
}

export interface IRepositoryModel {
  readonly name: string
  readonly displayName?: string
  readonly path: string
  readonly ghMeta?: IGHMeta
}

interface IGHMeta {
  readonly defaultBranch: string
  readonly isPrivate: boolean
  readonly cloneUrl: string
  readonly htmlUrl: string
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
