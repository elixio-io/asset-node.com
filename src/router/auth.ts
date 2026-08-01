import { FastifyPluginAsync } from 'fastify'
import { Type } from '@sinclair/typebox'
import { User } from '../models/User'

const authRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.post('/register', {
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String({ minLength: 6 }),
        companyName: Type.String({ minLength: 2 })
      })
    }
  }, async (request) => {
    try {
      const { email, password, companyName } = request.body as {
        email: string
        password: string
        companyName: string
      }

      const existingUser = await User.findOne({ email })
      if (existingUser) {
        throw new Error('Email already registered')
      }

      const user = new User({ email, companyName })
      user.setPassword(password)
      await user.save()

      return {
        success: true,
        user: {
          id: user._id,
          email: user.email,
          companyName: user.companyName
        }
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Registration failed')
    }
  })

  fastify.post('/login', {
    schema: {
      body: Type.Object({
        email: Type.String({ format: 'email' }),
        password: Type.String()
      })
    }
  }, async (request) => {
    try {
      const { email, password } = request.body as {
        email: string
        password: string
      }

      const user = await User.findOne({ email })
        .select('+hashedPassword +salt')
        .exec()

      if (!user) {
        throw new Error('Invalid email or password')
      }

      if (!user.validatePassword(password)) {
        throw new Error('Invalid email or password')
      }

      return {
        success: true,
        user: {
          id: user._id,
          email: user.email,
          companyName: user.companyName
        }
      }
    } catch (error) {
      throw new Error(error instanceof Error ? error.message : 'Login failed')
    }
  })
}

export default authRoutes