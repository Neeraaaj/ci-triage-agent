import { z } from 'zod';
import { callStructured, MODELS } from './llm.js';

const Verdict = z.object({
  reason: z.string().describe('One or two sentences: what each root cause says and whether they match.'),
  match: z.boolean(),
});

function buildUserMessage(reference: string, candidate: string){
    return [
    `<reference>${reference}</reference>`,
    `<candidate>\n${candidate}\n</candidate>`,
  ].join('\n\n');
}

const JUDGE_SYSTEM = `You grade a CI failure diagnosis.
Compare the CANDIDATE root cause with the REFERENCE root cause.
match = true only if the candidate identifies the same underlying problem: the same mistake in the same place. Wording may differ.
If the reference describes several problems, the candidate must cover all of them.
Extra correct detail is fine. A different, opposite or vaguer cause is not a match.`;

export async function judgeRootCause(reference: string, candidate: string) {
    const {data, usage} = await callStructured({
        model: MODELS.fast, 
        system: JUDGE_SYSTEM, 
        schema: Verdict, 
        maxTokens: 1000, 
        user: buildUserMessage(reference, candidate)
    });

    return { match: data.match, reason: data.reason, usage };  
}