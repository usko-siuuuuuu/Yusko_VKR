import client from './client'

export const login = async (email, password) => {
  const form = new URLSearchParams()
  form.append('grant_type', 'password')
  form.append('username', email)
  form.append('password', password)
  const response = await client.post('/auth/login', form, {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  })
  return response.data
}

export const getMe = async () => {
  const response = await client.get('/users/me')
  return response.data
}