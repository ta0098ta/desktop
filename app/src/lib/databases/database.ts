import * as Loki from 'lokijs'

const DbName = 'ghd.db'

enum Collections {
  Repositories = 'repositories',
}

interface IRepositoryModel {
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

export class Database {
  private db = new Loki(DbName)

  public constructor() {
    this.initCollections()
  }

  private initCollections() {
    if (this.db.getCollection(Collections.Repositories) == null) {
      this.db.addCollection<IRepositoryModel>(Collections.Repositories)
    }
  }
}
