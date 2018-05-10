import { git } from './core'
import { IRepository } from '../../database'

/** Open the merge tool for the given file. */
export async function openMergeTool(
  repository: IRepository,
  path: string
): Promise<void> {
  await git(['mergetool', path], repository.path, 'openMergeTool')
}
