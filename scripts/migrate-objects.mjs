import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import { Readable } from 'node:stream';
const required=name=>{if(!process.env[name])throw Error(`Missing ${name}`);return process.env[name];};
if(process.env.OBJECT_MIGRATION_ENABLED!=='true')throw Error('Set OBJECT_MIGRATION_ENABLED=true after reviewing source and target buckets.');
const source=new S3Client({region:'auto',endpoint:required('SOURCE_S3_ENDPOINT'),forcePathStyle:true,credentials:{accessKeyId:required('SOURCE_S3_ACCESS_KEY_ID'),secretAccessKey:required('SOURCE_S3_SECRET_ACCESS_KEY')}});
const target=new S3Client({region:required('WASABI_REGION'),endpoint:required('WASABI_ENDPOINT'),forcePathStyle:true,credentials:{accessKeyId:required('WASABI_ACCESS_KEY_ID'),secretAccessKey:required('WASABI_SECRET_ACCESS_KEY')},requestChecksumCalculation:'WHEN_REQUIRED'});
const sourceBucket=required('SOURCE_S3_BUCKET'),targetBucket=required('WASABI_BUCKET');
if(process.env.SOURCE_S3_ENDPOINT===process.env.WASABI_ENDPOINT&&sourceBucket===targetBucket)throw Error('Source and target must differ.');
await fs.mkdir('artifacts',{recursive:true});
let continuation;const manifest=[];
do {
 const page=await source.send(new ListObjectsV2Command({Bucket:sourceBucket,ContinuationToken:continuation}));
 for(const item of page.Contents||[]){
  const object=await source.send(new GetObjectCommand({Bucket:sourceBucket,Key:item.Key}));
  const hash=createHash('sha256');let bytes=0;
  async function* body(){for await(const chunk of object.Body){hash.update(chunk);bytes+=chunk.length;yield chunk;}}
  // Never overwrite an existing target object implicitly.
  try{await target.send(new HeadObjectCommand({Bucket:targetBucket,Key:item.Key}));throw Error(`Target object already exists; review inventory before retry: ${item.Key}`);}catch(error){if(error.$metadata?.httpStatusCode!==404)throw error;}
  await new Upload({client:target,params:{Bucket:targetBucket,Key:item.Key,Body:Readable.from(body()),ContentType:object.ContentType,Metadata:object.Metadata}}).done();
  const sha256=hash.digest('hex'),copy=await target.send(new GetObjectCommand({Bucket:targetBucket,Key:item.Key}));
  const check=createHash('sha256');for await(const chunk of copy.Body)check.update(chunk);
  if(check.digest('hex')!==sha256||bytes!==Number(item.Size))throw Error(`Object verification failed: ${item.Key}`);
  manifest.push({key:item.Key,size:bytes,sha256});
  await fs.writeFile('artifacts/object-migration.json',JSON.stringify(manifest,null,2));
 }
 continuation=page.IsTruncated?page.NextContinuationToken:undefined;
}while(continuation);
await target.send(new PutObjectCommand({Bucket:targetBucket,Key:'_migration/inventory.json',Body:JSON.stringify(manifest),ContentType:'application/json'}));
console.log(`Verified ${manifest.length} copied objects. Source objects were retained.`);
