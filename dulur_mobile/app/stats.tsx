import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { supabase, getFreshSession } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function StatsScreen() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const insets = useSafeAreaInsets();
  
  const [sessionData, setSessionData] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
  
  let statsUrl = `${BASE_URL}/is/tolfraedi?appview=true`;
  if (sessionData?.refresh_token) {
    const encodedTarget = encodeURIComponent(`/is/tolfraedi?appview=true`);
    statsUrl = `${BASE_URL}/api/auth/sync?refresh_token=${sessionData.refresh_token}&redirect=${encodedTarget}`;
  }

  useEffect(() => {
    fetchSessionData();
  }, []);

  const fetchSessionData = async () => {
    const session = await getFreshSession();
    setSessionData(session);
    setReady(true);
  };
  
  const INJECTED_JS = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        #mobile-menu, header[class*="sticky"], footer { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
        nav[role="navigation"] { display: none !important; }
        
        body { 
            background-color: transparent !important; 
            -webkit-user-select: none;
            user-select: none;
        }
      \`;
      document.documentElement.appendChild(style);
      
      const hideNavBars = () => {
         const headers = document.querySelectorAll('header, footer, nav');
         headers.forEach(el => {
            if (el.tagName === 'FOOTER' || el.classList.contains('sticky') || el.id === 'mobile-menu') {
                el.style.display = 'none';
            }
         });
      };
      
      setInterval(hideNavBars, 100);
    })();
    true;
  `;

  if (!ready) {
    return (
      <View className="flex-1 justify-center items-center bg-[#F9FAFB]">
        <ActivityIndicator size="large" color="#1c1917" />
      </View>
    );
  }

  return (
    <View className="flex-1 bg-background">
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      
      {!webViewLoaded && (
        <View className="absolute inset-0 z-40 bg-background flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#1c1917" />
        </View>
      )}

      <View className="w-full self-center" style={{ paddingTop: Math.max(insets.top + 16, 60), paddingBottom: 12, paddingHorizontal: 16, backgroundColor: '#ffffff', borderBottomWidth: 1, borderBottomColor: '#f1f5f9', zIndex: 100, elevation: 10, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4 }}>
          <View className="flex-row items-center justify-between w-full max-w-[500px] self-center">
              <TouchableOpacity 
                 onPress={() => router.back()}
                 className="flex-row items-center bg-slate-100 disabled:opacity-50 px-3 py-2 rounded-xl"
              >
                 <Ionicons name="chevron-back" size={18} color="#475569" />
                 <Text className="text-[15px] font-black text-slate-700 ml-1">Til baka</Text>
              </TouchableOpacity>
              <Text className="text-[18px] font-black font-serif text-[#1e1b4b] mr-4">Tölfræði</Text>
              <View style={{ width: 60 }} />
          </View>
      </View>
      
      <WebView
        ref={webViewRef}
        source={{ uri: statsUrl }}
        sharedCookiesEnabled={true}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        bounces={true}
        scrollEnabled={true}
        showsVerticalScrollIndicator={true}
        userAgent="DulurAppMobileWebview"
        onLoadEnd={() => setWebViewLoaded(true)}
        className="flex-1 bg-background"
        style={{ opacity: webViewLoaded ? 1 : 0 }}
      />
    </View>
  );
}
