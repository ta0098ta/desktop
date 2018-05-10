import { git } from './core'
import { IRemote } from '../../models/remote'
import { findDefaultRemote } from '../stores/helpers/find-default-remote'
import { IRepository } from '../../database'

/** Get the remote names. */
export async function getRemotes(
  repository: IRepository
): Promise<ReadonlyArray<IRemote>> {
  const result = await git(['remote', '-v'], repository.path, 'getRemotes')
  const output = result.stdout
  const lines = output.split('\n')
  const remotes = lines
    .filter(x => x.endsWith('(fetch)'))
    .map(x => x.split(/\s+/))
    .map(x => ({ name: x[0], url: x[1] }))

  return remotes
}

/** Get the name of the default remote. */
export async function getDefaultRemote(
  repository: IRepository
): Promise<IRemote | null> {
  return findDefaultRemote(await getRemotes(repository))
}

/** Add a new remote with the given URL. */
export async function addRemote(
  repository: IRepository,
  name: string,
  url: string
): Promise<IRemote> {
  await git(['remote', 'add', name, url], repository.path, 'addRemote')

  return { url, name }
}

/** Removes an existing remote, or silently errors if it doesn't exist */
export async function removeRemote(
  repository: IRepository,
  name: string
): Promise<void> {
  const options = {
    successExitCodes: new Set([0, 128]),
  }

  await git(
    ['remote', 'remove', name],
    repository.path,
    'removeRemote',
    options
  )
}

/** Changes the URL for the remote that matches the given name  */
export async function setRemoteURL(
  repository: IRepository,
  name: string,
  url: string
): Promise<void> {
  await git(['remote', 'set-url', name, url], repository.path, 'setRemoteURL')
}
