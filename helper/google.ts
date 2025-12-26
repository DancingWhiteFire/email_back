import type { gmail_v1 } from "googleapis";

function mapGmailMessageToEmail(userId: any, msg: gmail_v1.Schema$Message) {
  const headers = msg.payload?.headers ?? [];
  const getHeader = (name: string) =>
    headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ||
    "";

  const subject = getHeader("Subject");
  const from = getHeader("From");
  const internalDate = msg.internalDate
    ? new Date(Number(msg.internalDate))
    : new Date();

  return {
    userId,
    providerMsgId: msg.id!,
    threadId: msg.threadId || "",
    subject,
    snippet: msg.snippet || "",
    labels: msg.labelIds,
    body: extractBody(msg.payload),
    sender: from,
    receivedAt: internalDate,
  };
}

function extractBody(part?: gmail_v1.Schema$MessagePart): string {
  if (!part) return "";

  if (part.body?.data) return decodeBase64Url(part.body.data);

  if (part.parts?.length)
    for (const p of part.parts) {
      const mime = p.mimeType || "";
      if (mime === "text/html" || mime === "text/plain") {
        if (p.body?.data) return decodeBase64Url(p.body.data);
      }
    }

  return "";
}

function decodeBase64Url(data: string): string {
  const buff = Buffer.from(
    data.replace(/-/g, "+").replace(/_/g, "/"),
    "base64"
  );
  return buff.toString("utf8");
}

const getGmailMessage = async (gmail: gmail_v1.Gmail, id: string) => {
  return await gmail.users.messages.get({
    userId: "me",
    id,
    format: "full",
  });
};

export { mapGmailMessageToEmail, getGmailMessage };
