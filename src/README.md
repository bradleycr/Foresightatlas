# Foresight Fellows Map & Timeline

A responsive web application for visualizing where Foresight Institute fellows and grantees are located around the world and where they plan to be over the next year.

## 🎯 Overview

This application provides a public, read-only interface for tracking Foresight fellows, grantees, and prize winners across:

- **Map View**: Interactive world map showing current and future locations
- **Timeline View**: Year-focused Gantt-style timeline of travel plans
- **Public Submissions**: Anyone can suggest location updates
- **Admin Panel**: Secure interface for reviewing and approving suggestions

## ✨ Features

### For Public Users

- **Browse Fellows**: View all Foresight fellows, grantees, and prize winners
- **Filter & Search**: Filter by program type, focus area, home node, and search by name/project/city
- **Map Visualization**: See clustered markers showing where people are or will be
- **Timeline View**: Gantt-style view of upcoming travel and residencies
- **Submit Updates**: Anyone can suggest location updates (reviewed by admins)
- **Time Controls**: View by year, month, or week with adjustable granularity

### For Admins

- **Secure Login**: Simple authentication (currently stub, ready for Supabase)
- **Review Suggestions**: Browse pending location update requests
- **Approve/Reject**: Process suggestions with one click
- **Direct Editing**: Edit fellow data and travel windows directly (in prototype)

## 🏗️ Architecture

### Technology Stack

- **React** with TypeScript
- **Tailwind CSS** for styling
- **shadcn/ui** component library
- **Lucide React** for icons
- **In-memory data** (ready for Supabase integration)

### Project Structure

```
/
├── components/
│   ├── ui/                    # shadcn/ui components
│   ├── AppHeader.tsx          # Main navigation header
│   ├── FiltersBar.tsx         # Search and filter controls
│   ├── MapView.tsx            # Interactive map view
│   ├── TimelineView.tsx       # Gantt timeline view
│   ├── FellowCard.tsx         # Reusable fellow card component
│   ├── SuggestUpdateModal.tsx # Public suggestion form
│   ├── AdminLoginModal.tsx    # Admin authentication
│   └── AdminPanel.tsx         # Admin review interface
├── data/
│   └── mockData.ts            # Sample data and API stubs
├── types/
│   └── index.ts               # TypeScript type definitions
├── App.tsx                    # Main application component
├── INTEGRATION.md             # Backend integration guide
└── README.md                  # This file
```

## 🚀 Getting Started

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

### Demo Credentials

To access admin features:

- **Email**: admin@foresight.org
- **Password**: admin123

## 📊 Data Models

### Person (Fellow/Grantee)

```typescript
{
  id: string;
  fullName: string;
  roleType: "Fellow" | "Grantee" | "Prize Winner";
  fellowshipCohortYear: number;
  focusTags: string[];
  homeBaseCity: string;
  homeBaseCountry: string;
  currentCity: string;
  currentCountry: string;
  currentCoordinates: { lat: number; lng: number };
  primaryNode: "Global" | "Berlin Node" | "Bay Area Node";
  profileUrl: string;
  contactUrlOrHandle: string | null;
  shortProjectTagline: string;
  expandedProjectDescription: string;
  isAlumni: boolean;
}
```

### TravelWindow

```typescript
{
  id: string;
  personId: string;
  title: string;
  city: string;
  country: string;
  coordinates: { lat: number; lng: number };
  startDate: string; // ISO format
  endDate: string; // ISO format
  type: "Residency" | "Conference" | "Workshop" | "Visit" | "Other";
  notes: string;
}
```

### LocationSuggestion

```typescript
{
  id: string;
  personName: string;
  personEmailOrHandle: string;
  requestedChangeType: "New entry" | "Update location" | "Add travel window";
  requestedPayload: any; // JSON blob matching Person or TravelWindow
  createdAt: string; // ISO format
  status: "Pending" | "Accepted" | "Rejected";
}
```

## 🎨 Visual Design

The application matches Foresight Institute's visual identity:

- **Color Palette**:
  - Deep navy header: `#0a1628`
  - Teal accents: `#14b8a6` (teal-500)
  - Clean white backgrounds
  - Subtle gray borders

- **Typography**:
  - Clean sans-serif font
  - Strong hierarchy with h1-h4 headings
  - Consistent sizing and spacing

- **Components**:
  - Rounded cards with medium border radius
  - Soft shadows for depth
  - High-contrast text for accessibility
  - Clear hover and focus states

## 🔌 Backend Integration

This prototype uses **in-memory data** with clear integration points for a real backend.

### Quick Start: Supabase Integration

See **[INTEGRATION.md](./INTEGRATION.md)** for complete documentation on:

- Setting up Supabase tables
- Replacing in-memory data with API calls
- Implementing real authentication
- Adding Row Level Security (RLS)
- Setting up email notifications
- Environment variables

### Key Integration Points

All backend integration points are marked with `// TODO:` comments:

```typescript
// TODO: Replace with real API call
// Example: const { data } = await supabase.from('people').select('*')
```

Search the codebase:

```bash
grep -r "TODO" --include="*.ts" --include="*.tsx"
```

### Files to Modify for Backend

1. **`/data/mockData.ts`** - Replace all functions with API calls
2. **`/App.tsx`** - Update auth handlers and data fetching
3. **`/components/AdminLoginModal.tsx`** - Implement real auth
4. **`/components/AdminPanel.tsx`** - Add API calls for suggestions

## 📱 Responsive Design

The application is fully responsive:

- **Desktop** (1024px+): Side-by-side layouts, full controls
- **Tablet** (768px-1023px): Stacked layouts, touch-friendly
- **Mobile** (< 768px): Single-column, simplified controls

## 🔐 Security Considerations

**Important**: This prototype has stub authentication for demo purposes only.

For production deployment:

- ✅ Implement proper authentication (Supabase Auth, Auth0, etc.)
- ✅ Use Row Level Security (RLS) in your database
- ✅ Validate all user inputs server-side
- ✅ Use environment variables for API keys
- ✅ Enable HTTPS only
- ✅ Add rate limiting for public submissions
- ✅ Implement CSRF protection

## 🌐 Embedding in WordPress

To embed this application in a WordPress page:

1. **Build the application**:
   ```bash
   npm run build
   ```

2. **Upload to hosting** (Vercel, Netlify, or custom server)

3. **Add iframe to WordPress**:
   ```html
   <iframe 
     src="https://your-app-url.com" 
     width="100%" 
     height="800px" 
     frameborder="0"
     title="Foresight Fellows Map & Timeline"
   ></iframe>
   ```

4. **Optional**: Use a WordPress plugin like "Advanced iFrames" for better control

## 🧪 Sample Data

The prototype includes **10 diverse fellows** across:

- **Continents**: North America, Europe, Asia, Africa
- **Cities**: San Francisco, Berlin, Tokyo, Lagos, Mumbai, Seoul, Paris, Barcelona, Boston, Dublin
- **Focus Areas**: Secure AI, Neurotechnology, Longevity Biotechnology, Nanotechnology, Space, Existential Hope
- **Programs**: Fellows, Grantees, Prize Winners
- **Nodes**: Bay Area Node, Berlin Node, Global
- **Travel Windows**: 20+ upcoming trips, residencies, conferences

## 📈 Future Enhancements

Potential features for future development:

- [ ] Real-time updates via Supabase subscriptions
- [ ] Export data to CSV/iCal
- [ ] Email notifications for approved suggestions
- [ ] Photo galleries for each fellow
- [ ] Integration with calendar apps
- [ ] Network graph visualization
- [ ] Advanced search with Algolia
- [ ] Mobile app (React Native)
- [ ] Multi-language support

## 🤝 Contributing

This is a prototype built for Foresight Institute. For questions or suggestions:

1. Review the codebase and INTEGRATION.md
2. Test the admin flow with demo credentials
3. Submit suggestions via the "Suggest an update" button

## 📄 License

Built for Foresight Institute. All rights reserved.

## 🙏 Acknowledgments

- **Foresight Institute** for their mission to advance frontier science and technology
- **shadcn/ui** for the beautiful component library
- **Tailwind CSS** for the utility-first CSS framework
- **React** and **TypeScript** for the solid foundation

---

**Built with ❤️ for Foresight Institute**

*Advancing frontier science and technology since 1986*
