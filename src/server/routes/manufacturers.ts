import { Type } from '@sinclair/typebox'
import { Manufacturer } from '../../models/Manufacturer'
import { createCrudRoutes } from './crudRouteFactory'

export default createCrudRoutes({
  model: Manufacturer,
  entityName: 'Manufacturer',
  createSchema: Type.Object({
    name: Type.String({ minLength: 1 }),
    url: Type.Optional(Type.String()),
    supportUrl: Type.Optional(Type.String()),
    supportEmail: Type.Optional(Type.String()),
    notes: Type.Optional(Type.String()),
  }),
  updateSchema: Type.Object({
    name: Type.Optional(Type.String({ minLength: 1 })),
    url: Type.Optional(Type.String()),
    supportUrl: Type.Optional(Type.String()),
    supportEmail: Type.Optional(Type.String()),
    notes: Type.Optional(Type.String()),
  }),
})
