import { expect } from 'chai'

import { IRepository } from '../../src/models/repository'

describe('Repository', () => {
  describe('name', () => {
    it('uses the last path component as the name', async () => {
      const repoPath = '/some/cool/path'
      const repository = new IRepository(repoPath, -1, null, false)
      expect(repository.name).to.equal('path')
    })
  })
})
