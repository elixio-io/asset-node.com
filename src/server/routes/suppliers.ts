import { Type } from '@sinclair/typebox'
import { Supplier } from '../../models/Supplier'
import { createCrudRoutes } from './crudRouteFactory'

export default createCrudRoutes({
  model: Supplier,
  entityName: 'Supplier',
  createSchema: Type.Object({
    name: Type.String({ minLength: 1 }),
    contactName: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    url: Type.Optional(Type.String()),
    notes: Type.Optional(Type.String()),
  }),
  updateSchema: Type.Object({
    name: Type.Optional(Type.String({ minLength: 1 })),
    contactName: Type.Optional(Type.String()),
    email: Type.Optional(Type.String()),
    phone: Type.Optional(Type.String()),
    url: Type.Optional(Type.String()),
    notes: Type.Optional(Type.String()),
  }),
})
