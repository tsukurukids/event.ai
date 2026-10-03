export async function purgeExpiredGames(client, { dryRun = false, now = new Date().toISOString(), log = console.log } = {}) {
  let offset = 0;
  const expired = [];
  for (;;) {
    const {data, error} = await client.from('games').select('id, storage_path, expires_at')
      .like('storage_path', 'workshop/%').lte('expires_at', now).order('id').range(offset, offset + 499);
    if(error) throw error;
    expired.push(...data);
    if(data.length < 500) break;
    offset += 500;
  }
  let failures = 0;
  for(const game of expired) {
    try {
      if (!/^workshop\/[A-Za-z0-9_-]+$/.test(game.storage_path)) throw new Error('Unexpected storage path');
      const files = [];
      async function walk(prefix) {
        for(let offset=0;;offset+=1000) {
          const {data,error} = await client.storage.from('game-files').list(prefix, {limit:1000,offset,sortBy:{column:'name',order:'asc'}});
          if(error)throw error;
          for(const item of data) {
            const path=`${prefix}/${item.name}`;
            if(item.id===null)await walk(path); else files.push(path);
          }
          if(data.length<1000)break;
        }
      }
      await walk(game.storage_path);
      if(dryRun){log(`DRY RUN ${game.id}: ${files.length} files`);continue;}
      for(let i=0;i<files.length;i+=100) {
        const {error}=await client.storage.from('game-files').remove(files.slice(i,i+100));
        if(error)throw error;
      }
      const {error}=await client.from('games').delete().eq('id',game.id).lte('expires_at',now);
      if(error)throw error;
      log(`Deleted ${game.id}: ${files.length} files`);
    }catch(error){failures++;log(`Failed ${game.id}: ${error.message}`);}
  }
  if(failures)throw new Error(`${failures} cleanup failures; records retained for retry`);
  return expired.length;
}

