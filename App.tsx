import React from 'react';
import Page from './src/app/page';

// In a real Next.js app, this file isn't used the same way, 
// but for this structure, we render the main Page component.
export default function App() {
  return (
    <div className="bg-gray-50 min-h-screen">
      <Page />
    </div>
  );
}