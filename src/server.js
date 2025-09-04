// === DEBUG routes ===
app.get('/healthz', (_req, res) => {
  res.status(200).send('ok :: debug routes mounted');
});

app.get('/debug/item-files', async (req, res) => {
  const item_id = Number(req.query.item_id);
  if (!item_id) return res.status(400).json({ error: 'missing item_id' });
  try {
    const { fetchPodioFiles } = await import('../helpers/podio.js');
    const files = await fetchPodioFiles(item_id);
    res.json({
      item_id,
      count: files.length,
      files: files.map(f => ({
        file_id: f.file_id, name: f.name, mimetype: f.mimetype, size: f.size
      }))
    });
  } catch (e) {
    res.status(500).json({ error: String(e) });
  }
});
// === end DEBUG routes ===
