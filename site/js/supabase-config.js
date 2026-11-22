// Supabase Client & Data Layer for Satyaseva Sisters Portal
(function () {
  'use strict';

  const CONFIG = {
    url: 'https://eeuexatalklszcgwcuww.supabase.co',
    anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVldWV4YXRhbGtsc3pjZ3djdXd3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMzNTE2NjIsImV4cCI6MjEwODkyNzY2Mn0.zxmJ7BFof-a7-zbMYaIzkGe4PNiZQT1BhZLx1HTAfJY'
  };

  let client = null;
  function getClient() {
    if (!client && window.supabase && window.supabase.createClient) {
      client = window.supabase.createClient(CONFIG.url, CONFIG.anonKey);
    }
    return client;
  }

  // Unified Data API with automatic JSON fallback
  window.SSCS = {
    config: CONFIG,
    getClient: getClient,

    // Communities
    async getCommunities() {
      const sb = getClient();
      if (sb) {
        try {
          const { data: stations, error } = await sb.from('stations').select('*').order('name');
          if (!error && stations && stations.length > 0) {
            const [minRes, memRes, galRes] = await Promise.all([
              sb.from('station_ministries').select('*').order('sort_order'),
              sb.from('station_members').select('*').order('sort_order'),
              sb.from('station_gallery').select('*')
            ]);
            const ministries = minRes.data || [];
            const members = memRes.data || [];
            const gallery = galRes.data || [];

            return stations.map(st => ({
              id: st.id,
              name: st.name,
              established: st.established,
              location: st.location,
              country: st.country,
              badge: st.badge,
              description: st.description,
              heroImage: st.hero_image,
              contact: {
                address: st.address || '',
                phone: st.phone || '',
                email: st.email || ''
              },
              ministries: ministries.filter(m => m.station_id === st.id).map(m => m.ministry_text),
              members: members.filter(m => m.station_id === st.id),
              gallery: gallery.filter(g => g.station_id === st.id).map(g => g.image_path)
            }));
          }
        } catch (e) {
          console.warn('[SSCS] Supabase communities fetch failed, using fallback:', e);
        }
      }
      const res = await fetch('data/communities.json');
      return await res.json();
    },

    // Events
    async getEvents() {
      const sb = getClient();
      if (sb) {
        try {
          const { data, error } = await sb.from('events').select('*').order('date', { ascending: true });
          if (!error && data && data.length > 0) return data;
        } catch (e) {
          console.warn('[SSCS] Supabase events fetch failed, using fallback:', e);
        }
      }
      const res = await fetch('data/events.json');
      return await res.json();
    },

    // News
    async getNews() {
      const sb = getClient();
      if (sb) {
        try {
          const { data, error } = await sb.from('news').select('*').order('date', { ascending: false });
          if (!error && data && data.length > 0) return data;
        } catch (e) {
          console.warn('[SSCS] Supabase news fetch failed, using fallback:', e);
        }
      }
      const res = await fetch('data/news.json');
      return await res.json();
    },

    // Memorial Sisters
    async getMemorial() {
      const sb = getClient();
      if (sb) {
        try {
          const { data, error } = await sb.from('memorial_sisters').select('*').order('departure_date', { ascending: false });
          if (!error && data && data.length > 0) return data;
        } catch (e) {
          console.warn('[SSCS] Supabase memorial fetch failed, using fallback:', e);
        }
      }
      const res = await fetch('data/memorial.json');
      return await res.json();
    },

    // Submit Prayer Request
    async submitPrayer(name, intention) {
      const sb = getClient();
      if (!sb) {
        throw new Error('Supabase client unavailable. Please check your connection.');
      }
      const { data, error } = await sb.from('prayer_requests').insert([
        { name: name || 'Anonymous', intention: intention, status: 'pending' }
      ]).select();
      if (error) throw error;
      return data;
    },

    // Get Recent Prayers for Wall (e.g. latest 20)
    async getPrayers() {
      const sb = getClient();
      if (sb) {
        try {
          const { data, error } = await sb.from('prayer_requests')
            .select('id, name, intention, created_at')
            .order('created_at', { ascending: false })
            .limit(20);
          if (!error && data && data.length > 0) return data;
        } catch (e) {
          console.warn('[SSCS] Prayer wall fetch failed:', e);
        }
      }
      return [];
    }
  };
})();
