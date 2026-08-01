import mongoose, { Schema, Query } from 'mongoose'

export function softDeletePlugin(schema: Schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true }
  })

  const excludeDeleted = function (this: Query<any, any>) {
    const filter = this.getFilter()
    if (filter.deletedAt === undefined) {
      this.where({ deletedAt: null })
    }
  }

  const queryMethods = [
    'find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete',
    'count', 'countDocuments', 'estimatedDocumentCount'
  ]
  for (const method of queryMethods) {
    schema.pre(method as any, excludeDeleted)
  }

  schema.statics.softDelete = async function (id: string) {
    return this.updateOne(
      { _id: new mongoose.Types.ObjectId(id) },
      { $set: { deletedAt: new Date() } }
    )
  }

  schema.statics.restore = async function (id: string) {
    return this.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(id), deletedAt: { $ne: null } },
      { $set: { deletedAt: null } },
      { new: true }
    )
  }
}
