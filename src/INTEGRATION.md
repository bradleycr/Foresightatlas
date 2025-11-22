# Foresight Fellows Map & Timeline - Backend Integration Guide

## Overview

This application is currently running with **in-memory data** and **stub authentication**. This document outlines where and how to integrate a real backend (e.g., Supabase, Firebase, or custom API).

---

## 🔌 Backend Integration Points

### 1. **Data Layer** (`/data/mockData.ts`)

Currently using in-memory stores. Replace with API calls:

#### People (Fellows/Grantees)
```typescript
// Current (in-memory):
export const getAllPeople = (): Person[] => {
  return peopleStore;
};

// Replace with Supabase:
export const getAllPeople = async (): Promise<Person[]> => {
  const { data, error } = await supabase
    .from('people')
    .select('*');
  
  if (error) throw error;
  return data;
};
```

#### Travel Windows
```typescript
// Current (in-memory):
export const getAllTravelWindows = (): TravelWindow[] => {
  return travelWindowsStore;
};

// Replace with Supabase:
export const getAllTravelWindows = async (): Promise<TravelWindow[]> => {
  const { data, error } = await supabase
    .from('travel_windows')
    .select('*');
  
  if (error) throw error;
  return data;
};
```

#### Location Suggestions
```typescript
// Current (in-memory):
export const addSuggestion = (suggestion: any) => {
  suggestionsStore.push(suggestion);
};

// Replace with Supabase:
export const addSuggestion = async (suggestion: LocationSuggestion) => {
  const { data, error } = await supabase
    .from('suggestions')
    .insert(suggestion);
  
  if (error) throw error;
  return data;
};
```

#### Update Person/Travel Window
```typescript
// Current (in-memory):
export const updatePerson = (id: string, updates: Partial<Person>) => {
  const index = peopleStore.findIndex((p) => p.id === id);
  if (index !== -1) {
    peopleStore[index] = { ...peopleStore[index], ...updates };
  }
};

// Replace with Supabase:
export const updatePerson = async (id: string, updates: Partial<Person>) => {
  const { data, error } = await supabase
    .from('people')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
  return data;
};
```

---

### 2. **Authentication** (`/App.tsx` and `/components/AdminLoginModal.tsx`)

Currently using hard-coded credentials. Replace with real auth:

#### Login
```typescript
// Current (stub auth):
const handleAdminLogin = (email: string, password: string): boolean => {
  const admin = mockAdminUsers.find(
    (u) => u.email === email && u.passwordPlaceholder === password
  );
  if (admin) {
    setIsAdmin(true);
    setAdminUser(admin);
    return true;
  }
  return false;
};

// Replace with Supabase Auth:
const handleAdminLogin = async (email: string, password: string) => {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  
  if (error) {
    console.error('Login failed:', error);
    return false;
  }
  
  // Check if user has admin role
  const { data: profile } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', data.user.id)
    .single();
  
  if (profile) {
    setIsAdmin(true);
    setAdminUser(profile);
    return true;
  }
  
  return false;
};
```

#### Logout
```typescript
// Current (stub):
const handleLogout = () => {
  setIsAdmin(false);
  setAdminUser(null);
};

// Replace with Supabase:
const handleLogout = async () => {
  await supabase.auth.signOut();
  setIsAdmin(false);
  setAdminUser(null);
};
```

#### Session Management
Add this to `App.tsx` to maintain auth state:

```typescript
useEffect(() => {
  // Check for existing session on mount
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session) {
      // Fetch admin profile
      supabase
        .from('admin_users')
        .select('*')
        .eq('id', session.user.id)
        .single()
        .then(({ data }) => {
          if (data) {
            setIsAdmin(true);
            setAdminUser(data);
          }
        });
    }
  });

  // Listen for auth changes
  const {
    data: { subscription },
  } = supabase.auth.onAuthStateChange((_event, session) => {
    if (!session) {
      setIsAdmin(false);
      setAdminUser(null);
    }
  });

  return () => subscription.unsubscribe();
}, []);
```

---

### 3. **Admin Panel** (`/components/AdminPanel.tsx`)

Update suggestion handling to call backend:

#### Accept Suggestion
```typescript
// Current (in-memory):
const handleAcceptSuggestion = (id: string) => {
  updateSuggestionStatus(id, "Accepted");
  // Apply changes...
};

// Replace with Supabase:
const handleAcceptSuggestion = async (id: string) => {
  const suggestion = await supabase
    .from('suggestions')
    .select('*')
    .eq('id', id)
    .single();
  
  if (!suggestion.data) return;
  
  // Update suggestion status
  await supabase
    .from('suggestions')
    .update({ status: 'Accepted' })
    .eq('id', id);
  
  // Apply changes based on type
  if (suggestion.data.requestedChangeType === 'Add travel window') {
    await supabase.from('travel_windows').insert({
      personId: suggestion.data.personId,
      ...suggestion.data.requestedPayload,
    });
  } else if (suggestion.data.requestedChangeType === 'Update location') {
    await supabase
      .from('people')
      .update(suggestion.data.requestedPayload)
      .eq('id', suggestion.data.personId);
  }
  
  // Send notification email (optional)
  await fetch('/api/send-notification', {
    method: 'POST',
    body: JSON.stringify({
      email: suggestion.data.personEmailOrHandle,
      status: 'accepted',
    }),
  });
};
```

---

### 4. **Real-time Updates** (Optional Enhancement)

Add Supabase real-time subscriptions to auto-update data:

```typescript
// In App.tsx
useEffect(() => {
  // Subscribe to people changes
  const peopleSubscription = supabase
    .channel('people_changes')
    .on('postgres_changes', 
      { event: '*', schema: 'public', table: 'people' },
      (payload) => {
        console.log('People changed:', payload);
        // Refresh data
        refreshPeople();
      }
    )
    .subscribe();

  // Subscribe to travel windows
  const travelSubscription = supabase
    .channel('travel_changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: 'travel_windows' },
      (payload) => {
        console.log('Travel windows changed:', payload);
        refreshTravelWindows();
      }
    )
    .subscribe();

  return () => {
    peopleSubscription.unsubscribe();
    travelSubscription.unsubscribe();
  };
}, []);
```

---

## 🗄️ Database Schema (Supabase)

### Table: `people`

```sql
CREATE TABLE people (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  full_name TEXT NOT NULL,
  role_type TEXT CHECK (role_type IN ('Fellow', 'Grantee', 'Prize Winner')),
  fellowship_cohort_year INTEGER,
  focus_tags TEXT[],
  home_base_city TEXT,
  home_base_country TEXT,
  current_city TEXT,
  current_country TEXT,
  current_coordinates JSONB, -- { lat: number, lng: number }
  primary_node TEXT CHECK (primary_node IN ('Global', 'Berlin Node', 'Bay Area Node')),
  profile_url TEXT,
  contact_url_or_handle TEXT,
  short_project_tagline TEXT,
  expanded_project_description TEXT,
  is_alumni BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `travel_windows`

```sql
CREATE TABLE travel_windows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_id UUID REFERENCES people(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  city TEXT NOT NULL,
  country TEXT NOT NULL,
  coordinates JSONB, -- { lat: number, lng: number }
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  type TEXT CHECK (type IN ('Residency', 'Conference', 'Workshop', 'Visit', 'Other')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `suggestions`

```sql
CREATE TABLE suggestions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  person_name TEXT NOT NULL,
  person_email_or_handle TEXT NOT NULL,
  requested_change_type TEXT CHECK (requested_change_type IN ('New entry', 'Update location', 'Add travel window')),
  requested_payload JSONB NOT NULL,
  status TEXT CHECK (status IN ('Pending', 'Accepted', 'Rejected')) DEFAULT 'Pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Table: `admin_users`

```sql
CREATE TABLE admin_users (
  id UUID PRIMARY KEY REFERENCES auth.users(id),
  display_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 🔐 Row Level Security (RLS) Policies

Enable RLS on all tables and add policies:

```sql
-- People: Read for everyone, write for admins only
ALTER TABLE people ENABLE ROW LEVEL SECURITY;

CREATE POLICY "People are viewable by everyone"
  ON people FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update people"
  ON people FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Travel Windows: Similar policies
ALTER TABLE travel_windows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Travel windows viewable by everyone"
  ON travel_windows FOR SELECT
  USING (true);

CREATE POLICY "Only admins can modify travel windows"
  ON travel_windows FOR ALL
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

-- Suggestions: Anyone can insert, admins can view/update
ALTER TABLE suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can submit suggestions"
  ON suggestions FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Admins can view all suggestions"
  ON suggestions FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));

CREATE POLICY "Admins can update suggestions"
  ON suggestions FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM admin_users WHERE id = auth.uid()
  ));
```

---

## 📧 Notifications (Optional)

Set up Supabase Edge Functions or a separate API to send notification emails when suggestions are processed:

```typescript
// Edge Function: /functions/send-notification/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { email, status, suggestionId } = await req.json();
  
  // Send email using Resend, SendGrid, etc.
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('RESEND_API_KEY')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Foresight Institute <noreply@foresight.org>',
      to: email,
      subject: `Your location update was ${status}`,
      html: `<p>Your location update request has been ${status}.</p>`,
    }),
  });
  
  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
```

---

## 🚀 Next Steps

1. **Set up Supabase project** at https://supabase.com
2. **Create tables** using the SQL schema above
3. **Enable authentication** in Supabase dashboard
4. **Replace all TODO comments** in the codebase with actual Supabase calls
5. **Test authentication flow** with real users
6. **Set up RLS policies** for security
7. **(Optional) Add email notifications** using Edge Functions
8. **Deploy** to Vercel, Netlify, or your hosting platform

---

## 📝 Environment Variables

Create a `.env.local` file:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

Then initialize Supabase client:

```typescript
// /lib/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

## 🔍 Search for TODOs

All integration points are marked with `// TODO:` comments. Search the codebase for:

```bash
grep -r "TODO" --include="*.ts" --include="*.tsx"
```

This will show you all places where real backend integration is needed.
