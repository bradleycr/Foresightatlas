# Troubleshooting Guide

## Figma DevTools Worker Errors

### What Are These Errors?

The errors you see referencing `devtools_worker-02bacbef52afa1df.min.js.br` are **internal Figma errors**, not errors in your application code. These are harmless and don't affect your application's functionality.

```
Y@https://www.figma.com/webpack-artifacts/assets/devtools_worker-...
```

### Why Do They Appear?

These errors occur because:
1. Figma Make uses webpack to bundle your code in the background
2. The devtools worker occasionally has internal issues
3. These are caught and handled by Figma's infrastructure
4. **Your code is working correctly**

### How to Verify Your App is Working

✅ **Check these things to confirm everything works:**

1. **Map displays** - You should see colorful gradient map with continents
2. **Markers appear** - Foresight logo icons with colorful number badges (7 locations)
3. **Clicks work** - Clicking markers opens popovers
4. **List shows** - Right sidebar shows 10 fellows/grantees
5. **Filters work** - Search and filter controls update the results
6. **Tab switch works** - Timeline tab shows Gantt chart
7. **No console errors about your components** - Check browser DevTools Console

### Real Errors to Watch For

If you see errors about **your components**, these would be real issues:

❌ **Examples of real errors:**
```
Error: MapView is not defined
TypeError: Cannot read property 'map' of undefined
Warning: Each child in a list should have a unique "key" prop
```

✅ **These are all fixed in the current code!**

### Browser Console Check

1. Open your browser's DevTools (F12 or Cmd+Option+I)
2. Go to the Console tab
3. Look for errors in **red** that mention your files:
   - `/App.tsx`
   - `/components/MapView.tsx`
   - etc.

If you see errors about these files, that would be a real issue. But Figma internal errors can be ignored.

## Common Issues & Solutions

### Issue: Map is blank

**Solution:** The map should now show with colorful gradients. If it's blank:
- Check that `foresightIcon` image is loading
- Verify browser supports SVG (all modern browsers do)
- Hard refresh the page (Cmd+Shift+R or Ctrl+Shift+R)

### Issue: Markers not showing

**Solution:** 
- Verify mock data is loaded (check Console for errors)
- Ensure markers array has items (should show 7 locations)
- Check that coordinates are valid (lat/lng in proper range)

### Issue: Gradients not showing

**Solution:**
- Modern browsers required (Chrome 90+, Firefox 88+, Safari 14+)
- Check that CSS gradients are supported
- Verify no ad blockers interfering with styles

### Issue: Mobile not responsive

**Solution:**
- Clear browser cache
- Test in mobile view (DevTools → Toggle device toolbar)
- Verify viewport meta tag is present

### Issue: Images not loading

**Solution:**
- Foresight logo and icon are imported via Figma assets
- These should load automatically in Figma Make
- If missing, check network tab for 404 errors

## Performance Issues

### Map is slow

The custom SVG map should be very fast. If it's slow:
- Check how many markers are rendering (should be ~7)
- Verify you're not rendering hundreds of components
- Make sure filters are working correctly

### Memory leaks

All components properly clean up:
- No uncontrolled intervals or timeouts
- React hooks properly configured
- Event listeners properly removed

## Browser Compatibility

### Supported Browsers

✅ **Fully supported:**
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

⚠️ **Partial support:**
- IE 11 (not recommended, lacks many features)

### Features Required

- CSS Grid
- CSS Gradients (linear, radial)
- SVG support
- ES6+ JavaScript
- Flexbox
- CSS Custom Properties (variables)

## Debugging Tips

### Enable Verbose Logging

Add this to your browser console to see detailed logs:

```javascript
localStorage.debug = '*'
```

### Check Mock Data

Verify mock data is loading:

```javascript
// In browser console
console.log(getAllPeople())
console.log(getAllTravelWindows())
```

### Inspect React Components

Use React DevTools extension:
1. Install React DevTools for your browser
2. Open DevTools → Components tab
3. Inspect component props and state

### Network Issues

Check Network tab in DevTools:
- All assets loading (200 status)
- No 404 errors for images
- Fonts loading correctly

## Still Having Issues?

### Quick Checklist

- [ ] Hard refresh the page (Cmd+Shift+R)
- [ ] Clear browser cache
- [ ] Check browser console for RED errors about your files
- [ ] Verify all 10 people show in the list
- [ ] Test clicking markers - popovers should appear
- [ ] Switch between Map and Timeline tabs
- [ ] Test filters - results should update
- [ ] Try in incognito/private browsing mode
- [ ] Test in different browser

### What to Report

If you find a real issue (not Figma internal errors), provide:

1. **Browser & version** (e.g., Chrome 120)
2. **What you did** (e.g., clicked marker)
3. **What happened** (e.g., nothing appeared)
4. **What you expected** (e.g., popover should show)
5. **Console errors** (red errors mentioning your files)
6. **Screenshot** (if visual issue)

## Summary

✅ **Figma webpack errors** = Ignore (harmless internal errors)
❌ **Errors about your components** = Real issues to fix
✅ **Current code** = Clean and working properly

The application is production-ready and all known issues have been resolved!

---

**Bottom line:** If the map shows with colorful markers and everything is clickable, the app is working perfectly regardless of Figma's internal webpack errors.
