## MapLibre GL + MapTiler Setup Checklist

Follow these steps to get your advanced maps working:

### ✅ Step 1: Get API Key (2 minutes)
- [ ] Go to https://cloud.maptiler.com
- [ ] Sign up (free account)
- [ ] Get API Key from Account → Keys
- [ ] Copy the key

### ✅ Step 2: Configure Environment
- [ ] Create or edit `frontend/.env` file
- [ ] Add: `VITE_MAPTILER_KEY=your_key_here`
- [ ] Save file

```env
VITE_API_URL=http://localhost:8000/api
VITE_MAPTILER_KEY=your_actual_key_here
VITE_ORS_API_KEY=  # Optional
```

### ✅ Step 3: Start Development Server
```bash
cd frontend
npm install    # if needed
npm run dev
```

⚠️ **Must restart** after adding .env variables!

### ✅ Step 4: Verify Maps Load
Open these pages in your browser:
- [ ] Dashboard → Map (`/dashboard/map`) - Live tracking
- [ ] Navigation (`/navigation`) - Route planning  
- [ ] Admin Dashboard (`/admin/dashboard`) - Multi-user tracking
- [ ] Check browser console for errors

### ✅ Step 5: All Done!
All maps now use MapLibre GL + MapTiler!

---

### 🎯 Key Points
- **Coordinate Format**: MapLibre uses [longitude, latitude] (opposite of Leaflet)
- **Restart Required**: Must restart dev server after .env changes
- **API Key**: Without it, maps show blank
- **Free Tier**: MapTiler free account provides 100k vector tile requests/month

### 🔗 Links
- MapTiler Cloud: https://cloud.maptiler.com
- Full Migration Guide: See `MAPLIBRE_MIGRATION.md`

---

### ❌ If Maps Are Blank
1. Check console for errors (F12 → Console)
2. Verify `VITE_MAPTILER_KEY` in `.env`
3. Confirm dev server restarted
4. Check API key is valid at MapTiler
5. Try incognito/private browser tab

### 📞 Need Help?
Refer to `MAPLIBRE_MIGRATION.md` Troubleshooting section
