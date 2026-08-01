import mongoose from 'mongoose'
import dotenv from 'dotenv'
dotenv.config()

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || '')
  const users = await mongoose.connection.db!.collection('users').find({}).project({firstName:1,lastName:1,email:1,orgId:1,role:1}).toArray()
  for(const u of users) console.log(u.email, u.role, u.orgId?.toString(), u.firstName, u.lastName)
  const orgs = await mongoose.connection.db!.collection('organizations').find({}).project({name:1}).toArray()
  for(const o of orgs) console.log('ORG:', o._id.toString(), o.name)
  await mongoose.disconnect()
}
main()
