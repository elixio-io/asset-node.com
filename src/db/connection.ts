import mongoose from 'mongoose'

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/hardware-manager'

export async function connectDB(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI, {
      serverSelectionTimeoutMS: 10000,
      heartbeatFrequencyMS: 10000,
    })
    console.log('Connected to MongoDB')

    mongoose.connection.on('error', (error) => {
      console.error('MongoDB connection error:', error)
    })

    mongoose.connection.on('disconnected', () => {
      console.warn('MongoDB disconnected — Mongoose will auto-reconnect')
    })

    mongoose.connection.on('reconnected', () => {
      console.log('MongoDB reconnected')
    })

    process.on('SIGINT', async () => {
      await mongoose.connection.close()
      process.exit(0)
    })

    process.on('SIGTERM', async () => {
      await mongoose.connection.close()
      process.exit(0)
    })
  } catch (error) {
    console.error('Error connecting to MongoDB:', error)
    process.exit(1)
  }
}

export function getConnection() {
  return mongoose.connection
}
