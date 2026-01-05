import { NextResponse } from 'next/server';

// Handles preflight CORS requests
export async function OPTIONS() {
  return NextResponse.json({}, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}

export async function POST(req: Request) {
  try {
    const { openAIKey, assistantId, threadId, prompt } = await req.json();

    if (!openAIKey || !assistantId || !prompt) {
      return NextResponse.json(
        { error: 'Missing required fields: openAIKey, assistantId, prompt' },
        {
          status: 400,
          headers: { "Access-Control-Allow-Origin": "*" },
        }
      );
    }

    const headers = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${openAIKey}`,
      'OpenAI-Beta': 'assistants=v2',
    };

    let currentThreadId = threadId;

    // Step 1 - Create thread if not provided
    if (!currentThreadId) {
      const createThreadRes = await fetch('https://api.openai.com/v1/threads', {
        method: 'POST',
        headers,
        body: JSON.stringify({}),
      });
      if (!createThreadRes.ok) throw new Error('Failed to create thread');
      const threadData = await createThreadRes.json();
      currentThreadId = threadData.id;
    }

    // Step 2 - Add message to thread
    const addMessageRes = await fetch(
      `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          role: 'user',
          content: prompt,
        }),
      }
    );
    if (!addMessageRes.ok) throw new Error('Failed to add message');
    await addMessageRes.json();

    // Step 3 - Create run
    const createRunRes = await fetch(
      `https://api.openai.com/v1/threads/${currentThreadId}/runs`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({
          assistant_id: assistantId,
        }),
      }
    );
    if (!createRunRes.ok) throw new Error('Failed to create run');
    const runData = await createRunRes.json();
    const runId = runData.id;

    // Step 4 - Poll run status (max 10 tries × 10s)
    let runStatus = 'queued';
    for (let i = 0; i < 10; i++) {
      await new Promise((resolve) => setTimeout(resolve, 10000)); // wait 10 sec

      const runStatusRes = await fetch(
        `https://api.openai.com/v1/threads/${currentThreadId}/runs/${runId}`,
        { headers }
      );
      if (!runStatusRes.ok) throw new Error('Failed to fetch run status');
      const runStatusData = await runStatusRes.json();
      runStatus = runStatusData.status;

      if (runStatus === 'completed') break;
    }

    if (runStatus !== 'completed') {
      return NextResponse.json(
        {
          error: 'Run did not complete within polling limit',
          threadId: currentThreadId,
          runId,
          runStatus,
        },
        {
          status: 504,
          headers: { "Access-Control-Allow-Origin": "*" }, 
        }
      );
    }

    // Step 5 - Fetch messages
    const messagesRes = await fetch(
      `https://api.openai.com/v1/threads/${currentThreadId}/messages`,
      { headers }
    );
    if (!messagesRes.ok) throw new Error('Failed to fetch messages');
    const messagesData = await messagesRes.json();

    const latestMessage = messagesData.data[0]?.content?.[0]?.text?.value || '';

    return NextResponse.json(
      {
        latestMessage,
        threadId: currentThreadId,
        runId,
      },
      {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*" }, 
      }
    );
  } catch (err: any) {
    console.error(err);
    return NextResponse.json(
      { error: err.message || 'Unexpected error occurred' },
      {
        status: 500,
        headers: { "Access-Control-Allow-Origin": "*" }, 
      }
    );
  }
}
