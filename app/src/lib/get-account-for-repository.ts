import { Account } from '../models/account'
import { getAccountForEndpoint } from './api'
import { IRepository } from '../database'

/** Get the authenticated account for the repository. */
export function getAccountForRepository(
  accounts: ReadonlyArray<Account>,
  repository: IRepository
): Account | null {
  const gitHubRepository = repository.ghRepository

  return gitHubRepository == null
    ? null
    : getAccountForEndpoint(accounts, gitHubRepository.owner.endpoint)
}
