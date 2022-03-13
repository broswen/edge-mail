import {Env} from "./index";

export interface Message {
  sender: string
  recipient: string
  subject: string
  body: string
  received?: Date
  id?: number
}

export class Mailbox {
  state: DurableObjectState
  messages: Message[]

  constructor(state: DurableObjectState, env: Env) {
    this.state = state
    this.messages = []
    state.blockConcurrencyWhile(async () => {
      this.messages = (await this.state.storage?.get<Message[]>('messages')) ?? []
    })
  }

  async addMessage(message: Message) {
    this.messages.unshift(message)
    await this.state.storage?.put('messages', this.messages)
  }


  async fetch(request: Request) {
    const url = new URL(request.url)
    switch (request.method) {
      case 'GET': {
        // return list of messages
        return new Response(JSON.stringify(this.messages))
        break
      }
      case 'POST': {
        const message = await request.json<Message>()
        message.received = new Date()
        message.id = this.messages.length
        await this.addMessage(message)
        return new Response('OK')
      }
      default: {
        return new Response('not allowed', {status: 405})
      }
    }
  }
}