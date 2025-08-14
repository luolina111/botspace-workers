import { createSchema, createYoga } from 'graphql-yoga';
import OpenAI from "openai";
import type { ExportedHandler, ExecutionContext } from '@cloudflare/workers-types';

interface Env {
  OPENAI_API_KEY: string;     // OpenAI 的 Key
  ENVIRONMENT?: string;
  DOMAIN?: string;
}

export interface ChatCompletion {
  role: string;
  content: string;
}

async function askLLM(prompt: string, env: Env): Promise<string> {

	const client = new OpenAI({ apiKey: "" });
	
	try {
    const response = await client.responses.create({
      model: "gpt-5",
      reasoning: { effort: "low" },
      instructions: "Answer concisely.",
      input: prompt,
    });
    // 返回 AI 输出文本
    return response.output_text ?? "无响应";
  } catch (err) {
    console.error("OpenAI API Error:", err);
    return "请求失败";
  }
}

function getCORSHeaders(origin: string, env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
}

export default {
	async fetch(request: Request, env:Env, ctx:ExecutionContext): Promise<Response> {
		const url = new URL(request.url);
		if (request?.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: getCORSHeaders(url.origin, env),
      });
    }

		const yoga = createYoga({
      schema: createSchema({
        typeDefs: /* GraphQL */ `
          type Query {
            ask(prompt: String!): String!
          }
        `,
        resolvers: {
          Query: {
            ask: async (_: any, { prompt }: { prompt: string }, context: any) => {
              return await askLLM(prompt, context.env);
            },
          },
        },
      }),
      context: () => ({ env }),
      cors: false,
      graphiql: env.ENVIRONMENT !== 'production',
      graphqlEndpoint: '/graphql',
    });
		
		const res = await yoga.fetch(request, { env, ctx });
    const headers = getCORSHeaders(url.origin, env);
    const finalHeaders = new Headers(res.headers);
    Object.entries(headers).forEach(([key, value]) => finalHeaders.set(key, value));

    return new Response(res.body, {
      status: res.status,
      headers: finalHeaders,
    });
		// return new Response('Hello World!');
	},
};
