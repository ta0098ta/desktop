/* eslint-disable no-sync */

import * as path from 'path'
import { expect } from 'chai'

import { IRepository } from '../../../src/models/repository'
import { reset, resetPaths, GitResetMode } from '../../../src/lib/git/reset'
import { getStatus } from '../../../src/lib/git/status'
import { setupFixtureRepository } from '../../helpers/repositories'
import { GitProcess } from 'dugite'

import * as fs from 'fs-extra'

describe('git/reset', () => {
  let repository: IRepository | null = null

  beforeEach(() => {
    const testRepoPath = setupFixtureRepository('test-repo')
    repository = new IRepository(testRepoPath, -1, null, false)
  })

  describe('reset', () => {
    it('can hard reset a repository', async () => {
      const repoPath = repository!.path
      const fileName = 'README.md'
      const filePath = path.join(repoPath, fileName)

      fs.writeFileSync(filePath, 'Hi world\n')

      await reset(repository!, GitResetMode.Hard, 'HEAD')

      const status = await getStatus(repository!)
      expect(status.workingDirectory.files.length).to.equal(0)
    })
  })

  describe('resetPaths', () => {
    it.skip('resets discarded staged file', async () => {
      const repoPath = repository!.path
      const fileName = 'README.md'
      const filePath = path.join(repoPath, fileName)

      // modify the file
      fs.writeFileSync(filePath, 'Hi world\n')

      // stage the file, then delete it to mimic discarding
      GitProcess.exec(['add', fileName], repoPath)
      fs.unlinkSync(filePath)

      await resetPaths(repository!, GitResetMode.Mixed, 'HEAD', [filePath])

      // then checkout the version from the index to restore it
      await GitProcess.exec(
        ['checkout-index', '-f', '-u', '-q', '--', fileName],
        repoPath
      )

      const status = await getStatus(repository!)
      expect(status.workingDirectory.files.length).to.equal(0)
    })
  })
})
