import { git } from './core'
import { IRepository } from '../../database'

/** Merge the named branch into the current branch. */
export async function merge(
  repository: IRepository,
  branch: string
): Promise<void> {
  await git(['merge', branch], repository.path, 'merge')
}

export async function getMergeBase(
  repository: IRepository,
  firstRef: string,
  secondRef: string
): Promise<string> {
  const process = await git(
    ['merge-base', firstRef, secondRef],
    repository.path,
    'merge-base'
  )
  return process.stdout.trim()
}
