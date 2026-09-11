import { S3Client, GetObjectCommand, PutObjectCommand, DeleteObjectCommand, DeleteObjectsCommand, HeadBucketCommand } from '@aws-sdk/client-s3';
import { required } from './config';
import { log } from './logger';
let client:S3Client|undefined;
export function s3() {
  return client ??= new S3Client({
    region:required('WASABI_REGION'),endpoint:required('WASABI_ENDPOINT'),forcePathStyle:true,
    credentials:{accessKeyId:required('WASABI_ACCESS_KEY_ID'),secretAccessKey:required('WASABI_SECRET_ACCESS_KEY')},
    requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',maxAttempts:3,
    requestHandler:{connectionTimeout:3000,requestTimeout:15000,throwOnRequestTimeout:true},
  });
}
export function bucket() { return required('WASABI_BUCKET'); }
function checkedKey(key:string) {
  if(!key || key.startsWith('/') || key.includes('..') || /[\x00-\x1f\\]/.test(key)) throw Error('Invalid file key.');
  return key;
}
export const files = {
  async get(key:string) {
    try {
      const result=await s3().send(new GetObjectCommand({Bucket:bucket(),Key:checkedKey(key)}));
      if(!result.Body) return null;
      return {body:result.Body.transformToWebStream(),httpMetadata:{contentType:result.ContentType},size:result.ContentLength};
    } catch(error) {
      if((error as {$metadata?:{httpStatusCode?:number}}).$metadata?.httpStatusCode===404)return null;
      log('error','storage.read_failed');throw Error('Database unavailable.');
    }
  },
  async put(key:string,input:Uint8Array|ReadableStream<Uint8Array>,options:{httpMetadata:{contentType?:string}}) {
    let bytes:Uint8Array;
    if(input instanceof Uint8Array) bytes=input;
    else {
      const reader=input.getReader(),parts:Uint8Array[]=[];let size=0;
      try { while(true) {const {value,done}=await reader.read();if(done)break;
        size+=value.byteLength;if(size>10*1024*1024){await reader.cancel();throw Error('Files must be under 10 MB.');}parts.push(value);
      }} finally {reader.releaseLock();}
      bytes=new Uint8Array(size);let offset=0;for(const part of parts){bytes.set(part,offset);offset+=part.length;}
    }
    if(bytes.byteLength>10*1024*1024)throw Error('Files must be under 10 MB.');
    try { await s3().send(new PutObjectCommand({Bucket:bucket(),Key:checkedKey(key),Body:bytes,ContentType:options.httpMetadata.contentType})); }
    catch {log('error','storage.write_failed');throw Error('Database unavailable.');}
  },
  async delete(key:string|string[]) {
    try {
      if(Array.isArray(key)) {
        for(let offset=0;offset<key.length;offset+=1000) {
          const result=await s3().send(new DeleteObjectsCommand({Bucket:bucket(),Delete:{Objects:key.slice(offset,offset+1000).map(k=>({Key:checkedKey(k)}))}}));
          if(result.Errors?.length)throw Error('Object deletion failed.');
        }
      } else await s3().send(new DeleteObjectCommand({Bucket:bucket(),Key:checkedKey(key)}));
    } catch {log('error','storage.delete_failed');throw Error('Database unavailable.');}
  },
  async health(){await s3().send(new HeadBucketCommand({Bucket:bucket()}),{abortSignal:AbortSignal.timeout(5000)});},
};
