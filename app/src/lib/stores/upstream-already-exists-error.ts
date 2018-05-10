import { IRemote } from '../../models/remote'
import { IRepository } from '../../database'

/**
 * The error thrown when a repository is a fork but its upstream remote isn't
 * the parent.
 */
export class UpstreamAlreadyExistsError extends Error {
  public readonly repository: IRepository
  public readonly existingRemote: IRemote

  public constructor(repository: IRepository, existingRemote: IRemote) {
    super(`The remote '${existingRemote.name}' already exists`)

    this.repository = repository
    this.existingRemote = existingRemote
  }
}
