# Google Maps Integration Guide

## Current Implementation

The map currently uses a **beautiful custom SVG-based visualization** with:
- ✅ Foresight Institute branded markers
- ✅ Colorful gradients matching Foresight's website
- ✅ Interactive popups and tooltips
- ✅ Number badges showing people per location
- ✅ Smooth animations and responsive design
- ✅ **Works immediately with no setup required**

## Optional: Add Google Maps Background (Advanced)

If you want to add a real Google Maps background underneath, follow these steps:

### Step 1: Get a Free Google Maps API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select existing)
3. Enable **Maps JavaScript API**
4. Go to **Credentials** → Create **API Key**
5. Restrict the key to your domain for security
6. Copy your API key

### Step 2: Add the API Key to the Code

Open `/components/MapView.tsx` and find this line:

```typescript
src={`https://www.google.com/maps/embed/v1/view?key=YOUR_GOOGLE_MAPS_API_KEY&center=${center.lat},${center.lng}&zoom=2`}
```

Replace `YOUR_GOOGLE_MAPS_API_KEY` with your actual API key:

```typescript
src={`https://www.google.com/maps/embed/v1/view?key=AIzaSyBzL...(your key)&center=${center.lat},${center.lng}&zoom=2`}
```

### Step 3: Adjust Styling (Optional)

If you add Google Maps, you may want to adjust the overlay opacity:

```typescript
// In MapView.tsx, find the gradient overlay div and adjust opacity
<div className="absolute inset-0 bg-gradient-to-br from-blue-50/30 via-transparent to-pink-50/30">
```

## Alternative: Modern Google Maps Library (2025 Best Practice)

For more control, you can use the modern `@vis.gl/react-google-maps` package:

### Install the package:

```bash
npm install @vis.gl/react-google-maps
```

### Example implementation:

```typescript
import { APIProvider, Map, Marker } from '@vis.gl/react-google-maps';

function MapWithGoogleMaps() {
  return (
    <APIProvider apiKey="YOUR_API_KEY">
      <Map
        defaultCenter={{ lat: 20, lng: 0 }}
        defaultZoom={2}
        style={{ width: '100%', height: '100%' }}
        mapId="YOUR_MAP_ID" // Optional: for custom styling
      >
        {markers.map((marker, idx) => (
          <Marker
            key={idx}
            position={marker.coordinates}
            icon={{
              url: foresightIcon,
              scaledSize: { width: 40, height: 40 }
            }}
          />
        ))}
      </Map>
    </APIProvider>
  );
}
```

## Pricing Information

**Google Maps Platform pricing:**
- **Free tier**: $200 credit/month (equals ~28,000 map loads)
- **Cost after free tier**: ~$7 per 1,000 map loads
- **Static Maps API**: $2 per 1,000 requests
- **For most websites**: You'll stay within the free tier

## Recommendation

**For now, the custom map implementation is:**
- ✅ Free forever (no API keys needed)
- ✅ Fast and lightweight
- ✅ Beautiful with Foresight branding
- ✅ Fully functional
- ✅ No rate limits or quotas
- ✅ Works on all devices

**Only add Google Maps if:**
- You need satellite imagery
- You want street-level detail
- You need users to interact deeply with the map
- You have budget for API costs at scale

## Current Features That Work Without Google Maps

Everything in the app works perfectly right now:
1. ✅ Interactive markers with click/hover
2. ✅ Colorful gradient badges (blue, purple, pink, green, etc.)
3. ✅ Location-based positioning (Web Mercator projection)
4. ✅ Popover details for each location
5. ✅ Mobile responsive design
6. ✅ Smooth animations
7. ✅ Foresight Institute branding
8. ✅ Number indicators per location

The map is production-ready as-is!

## Questions?

- **Why isn't Google Maps showing?** - It requires an API key (see Step 1-2 above)
- **Do I need Google Maps?** - No! The current implementation is beautiful and functional
- **Is the custom map accurate?** - Yes, it uses standard Web Mercator projection
- **Can I customize colors?** - Absolutely! See the gradient variables in MapView.tsx

---

**Bottom line:** The map works great right now with beautiful Foresight gradients. Only add Google Maps if you specifically need satellite imagery or street details.
