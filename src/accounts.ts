import {Env} from './index'
import jwt from '@tsndr/cloudflare-worker-jwt'

const jwtSecret = 'supersecretforjwt'
const expirationSeconds = 60*60*24

export interface UserParams {
    username: string
    password: string
}

export async function registerAccount(params: UserParams, env: Env): Promise<Response> {
    const existingAccount = await env.ACCOUNTS.get(params.username)
    if (existingAccount) {
        return new Response('username already in use', {status: 400})
    }
    if (params.password === '' || params.username === '') {
        return new Response('bad account parameters', {status: 400})
    }

    // todo: hash password
    // const encodedPassword = new TextEncoder().encode(params.password)
    // const hash = await crypto.subtle.digest('SHA-256', encodedPassword)
    await env.ACCOUNTS.put(params.username, params.password)
    return new Response('OK')
}

export async function login(params: UserParams, env: Env): Promise<string | null> {
    const existingAccount = await env.ACCOUNTS.get(params.username)
    if (!existingAccount) {
        return null
    }

    // todo: hash password
    // const encodedPassword = new TextEncoder().encode(params.password)
    // const hash = await crypto.subtle.digest('SHA-256', encodedPassword)
    // if (hash !== existingAccount) {
    //     return null
    // }
    if (params.password !== existingAccount) {
        return null
    }
    const token = await jwt.sign({
        sub: params.username,
        iss: 'edge-mail',
        exp: Math.floor(Date.now() / 1000) + expirationSeconds
    }, jwtSecret)
    return token
}

// returns username from jwt if valid, otherwise null
export async function validateRequest(request: Request): Promise<string | null> {
    const auth = request.headers.get('Authorization')
    if (!auth) return null
    const parts = auth.split(' ')
    if (parts.length !== 2) return null
    const token = parts[1]
    if (!(await jwt.verify(token, jwtSecret))) {
       return null
    }
    const decoded = jwt.decode(token)
    if (decoded) {
        return (decoded as {sub: string}).sub
    }
    return null
}