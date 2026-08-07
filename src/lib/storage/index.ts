import "server-only";

import { randomUUID } from "crypto";
import {
  PutObjectCommand,
  GetObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const MAX_DOCUMENTO_SIZE_BYTES = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export class InvalidUploadError extends Error {}

/**
 * Lançado quando as variáveis de ambiente de storage não estão configuradas.
 * Documento é opcional no cadastro (spec: "apenas armazenados — não há etapa
 * de aprovação"), então isso nunca deve derrubar o fluxo de cadastro do
 * veículo — só o upload em si falha, com uma mensagem clara.
 */
export class StorageNotConfiguredError extends Error {}

function getClient(): S3Client {
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION || "auto";
  const accessKeyId = process.env.STORAGE_ACCESS_KEY_ID;
  const secretAccessKey = process.env.STORAGE_SECRET_ACCESS_KEY;

  if (!endpoint || !accessKeyId || !secretAccessKey) {
    throw new StorageNotConfiguredError(
      "Envio de documentos ainda não está configurado neste ambiente (STORAGE_ENDPOINT/STORAGE_ACCESS_KEY_ID/STORAGE_SECRET_ACCESS_KEY). O veículo foi salvo normalmente; envie o documento depois."
    );
  }

  return new S3Client({
    endpoint,
    region,
    credentials: { accessKeyId, secretAccessKey },
    // Provedores compatíveis com S3 (ex: Cloudflare R2) exigem path-style.
    forcePathStyle: true,
  });
}

function getBucket(): string {
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) {
    throw new StorageNotConfiguredError(
      "Envio de documentos ainda não está configurado neste ambiente (STORAGE_BUCKET). O veículo foi salvo normalmente; envie o documento depois."
    );
  }
  return bucket;
}

/**
 * Faz upload do documento do veículo e retorna a chave (key) do objeto no
 * bucket. Armazenamos apenas a chave no banco (`documento_url`) — a URL de
 * acesso é sempre gerada sob demanda (pública, se configurada, ou assinada).
 */
export async function uploadVeiculoDocumento(params: {
  motoristaId: string;
  veiculoId: string;
  file: File;
}): Promise<string> {
  const { motoristaId, veiculoId, file } = params;

  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new InvalidUploadError(
      "Tipo de arquivo não permitido. Envie PDF, JPG, PNG ou WEBP."
    );
  }
  if (file.size > MAX_DOCUMENTO_SIZE_BYTES) {
    throw new InvalidUploadError("Arquivo muito grande. O limite é 10MB.");
  }

  const extension = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
  const key = `motoristas/${motoristaId}/veiculos/${veiculoId}/documento-${randomUUID()}.${extension}`;

  const client = getClient();
  const buffer = Buffer.from(await file.arrayBuffer());

  await client.send(
    new PutObjectCommand({
      Bucket: getBucket(),
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  );

  return key;
}

/**
 * Resolve a chave armazenada em `documento_url` para uma URL utilizável pelo
 * navegador. Se `STORAGE_PUBLIC_BASE_URL` estiver configurada, monta a URL
 * pública diretamente; caso contrário, gera uma signed URL de curta duração.
 */
export async function resolveDocumentoUrl(key: string): Promise<string> {
  const publicBase = process.env.STORAGE_PUBLIC_BASE_URL;
  if (publicBase) {
    return `${publicBase.replace(/\/$/, "")}/${key}`;
  }

  const client = getClient();
  const command = new GetObjectCommand({ Bucket: getBucket(), Key: key });
  return getSignedUrl(client, command, { expiresIn: 300 });
}
