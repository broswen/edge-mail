import {login, registerAccount, UserParams, validateRequest} from "./accounts";
import {Message} from "./mailbox";

export { Mailbox } from './mailbox'


export default {
  fetch: async (request: Request, env: Env) => {
    const url = new URL(request.url)
    if (request.method === 'POST' && url.pathname === '/register') {
      return registerHandler(request, env)
    }
    if (request.method === 'POST' && url.pathname === '/login') {
      return loginHandler(request, env)
    }

    if (request.method === 'GET' && url.pathname === '/mail') {
      return listMailhandler(request, env)
    }

    if (request.method === 'POST' && url.pathname === '/mail') {
      return postMailHandler(request, env)
    }
    return new Response('not found', {status: 404})
  }
}

// todo: get singular message by id
// todo: marked read/deleted by list of ids

async function registerHandler(request: Request, env: Env): Promise<Response> {
  const params = (await request.json()) as UserParams
  if (!params.username || !params.password) {
    return new Response('bad request', {status: 400})
  }
  return await registerAccount(params, env)
}

async function loginHandler(request: Request, env: Env): Promise<Response> {
  const authorization = request.headers.get('Authorization')
  if (!authorization) {
    return new Response('not authorized', {status: 401})
  }
  const parts = authorization.split(' ')
  console.log('parts', parts)
  if (parts.length !== 2) {
    return new Response('bad authorization', {status: 400})
  }
  const details = atob(parts[1]).split(':')
  console.log('details', details)
  if (details.length !== 2) {
    return new Response('bad authorization', {status: 400})
  }
  const params: UserParams = {
    username: details[0],
    password: details[1]
  }
  const token = await login(params, env)
  console.log('token', token)
  if (!token) {
    return new Response('bad authorization', {status: 400})
  }
  return new Response(JSON.stringify({jwt: token}))
}

async function listMailhandler(request: Request, env: Env): Promise<Response> {
  const username = await validateRequest(request)
  if (!username) {
    return new Response('not authorized', {status: 401})
  }
  const mailbox = getMailbox(username, env)
  return mailbox.fetch(request)
}

async function postMailHandler(request: Request, env: Env): Promise<Response> {
  const username = await validateRequest(request)
  if (!username) {
    return new Response('not authorized', {status: 401})
  }
  const message = await request.json<Message>()
  message.sender = username
  if (message.subject === '') {
    return new Response('subject must not be blank', {status: 400})
  }
  if (message.body === '') {
    return new Response('body must not be empty', {status: 400})
  }
  if (message.recipient === '') {
    return new Response('recipient must not be blank', {status: 400})
  }
  const existingAccount = await env.ACCOUNTS.get(message.recipient)
  if (!existingAccount) {
    return new Response('recipient not found', {status: 400})
  }
  const mailbox = getMailbox(message.recipient, env)
  return mailbox.fetch(request, {body: JSON.stringify(message)})
}

function getMailbox(username: string, env: Env): DurableObjectStub {
  const id = env.MAILBOX.idFromName(username)
  const obj = env.MAILBOX.get(id)
  return obj
}

export interface Env {
  MAILBOX: DurableObjectNamespace
  ACCOUNTS: KVNamespace
}
