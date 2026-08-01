import { connectDB } from '../connection.ts'
import mongoose from 'mongoose'

async function createCollections() {
  try {
    await connectDB()

    await mongoose.connection.createCollection('hardware', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['serialNumber', 'model', 'type', 'status', 'purchaseDate'],
          properties: {
            serialNumber: { bsonType: 'string' },
            model: { bsonType: 'string' },
            type: { enum: ['MacBook Pro', 'MacBook Air'] },
            status: { enum: ['available', 'assigned', 'defective', 'forSale'] },
            purchaseDate: { bsonType: 'date' },
            assignedTo: { bsonType: 'string' },
            adminPassword: { bsonType: 'string' },
            defectDescription: { bsonType: 'string' },
            salePrice: { bsonType: 'number' }
          }
        }
      }
    })

    await mongoose.connection.createCollection('peripherals', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['type', 'model', 'serialNumber'],
          properties: {
            type: { enum: ['mouse', 'keyboard', 'monitor'] },
            model: { bsonType: 'string' },
            serialNumber: { bsonType: 'string' },
            assignedTo: { bsonType: 'string' }
          }
        }
      }
    })

    await mongoose.connection.createCollection('assignments', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['employeeId', 'employeeName', 'hardware', 'assignmentDate'],
          properties: {
            employeeId: { bsonType: 'string' },
            employeeName: { bsonType: 'string' },
            hardware: { bsonType: 'array' },
            peripherals: { bsonType: 'array' },
            assignmentDate: { bsonType: 'date' }
          }
        }
      }
    })

    await mongoose.connection.createCollection('ailogs', {
      validator: {
        $jsonSchema: {
          bsonType: 'object',
          required: ['timestamp', 'prompt', 'rawResponse', 'hardware'],
          properties: {
            timestamp: { bsonType: 'date' },
            prompt: { bsonType: 'string' },
            rawResponse: { bsonType: 'string' },
            parsedResponse: {
              bsonType: 'array',
              items: {
                bsonType: 'object',
                required: ['price', 'source', 'url'],
                properties: {
                  price: { bsonType: 'number' },
                  source: { bsonType: 'string' },
                  url: { bsonType: 'string' }
                }
              }
            },
            hardware: {
              bsonType: 'object',
              required: ['type', 'model'],
              properties: {
                type: { bsonType: 'string' },
                model: { bsonType: 'string' }
              }
            }
          }
        }
      }
    })

    console.log('Collections created successfully')
    process.exit(0)
  } catch (error) {
    console.error('Error creating collections:', error)
    process.exit(1)
  }
}

createCollections()