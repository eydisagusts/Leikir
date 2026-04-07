import React, { useEffect, useState, useRef } from 'react';
import { View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { WebView } from 'react-native-webview';
import { supabase } from '@/lib/supabase';
import { Ionicons } from '@expo/vector-icons';

export default function GameHybridWrapper() {
  const { id, isEvent } = useLocalSearchParams();
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  
  const [sessionData, setSessionData] = useState<any>(null);
  const [ready, setReady] = useState(false);
  const [webViewLoaded, setWebViewLoaded] = useState(false);

  const BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://dulur.is';
  const targetPath = isEvent ? `vidburdur/${id}` : id;
  
  let gameUrl = `${BASE_URL}/is/${targetPath}?appview=true`;
  if (sessionData?.refresh_token) {
    const encodedTarget = encodeURIComponent(`/is/${targetPath}?appview=true`);
    gameUrl = `${BASE_URL}/api/auth/sync?refresh_token=${sessionData.refresh_token}&redirect=${encodedTarget}`;
  }

  useEffect(() => {
    fetchSessionData();
  }, []);

  const fetchSessionData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setSessionData(session);
    setReady(true);
  };

  const INJECTED_JS = `
    (function() {
      const style = document.createElement('style');
      style.innerHTML = \`
        /* Aggressive CSS to hide all website scaffolding instantly */
        header.sticky, footer, #mobile-menu, nav[role="navigation"] { display: none !important; opacity: 0 !important; visibility: hidden !important; pointer-events: none !important; }
        
        body, html {
           background-color: transparent !important;
           -webkit-touch-callout: none;
           -webkit-user-select: none;
           user-select: none;
        }
        
        main { padding-top: 0px !important; margin-top: 0px !important; }
        main > div { padding-top: 0px !important; margin-top: 0px !important; }
      \`;
      document.documentElement.appendChild(style);
      
      setInterval(() => {
         const headers = document.querySelectorAll('header.sticky, footer');
         headers.forEach(el => el.style.display = 'none');
      }, 10);
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
    <SafeAreaView className="flex-1 bg-background" edges={['top']}>
      <Stack.Screen options={{ headerShown: false, animation: 'fade' }} />
      
      {/* Loading Overlay covers the webview until it perfectly loads */}
      {!webViewLoaded && (
        <View className="absolute inset-0 z-40 bg-background flex-1 justify-center items-center">
            <ActivityIndicator size="large" color="#1c1917" />
        </View>
      )}

      <View className="absolute top-[56px] w-full px-4 self-center max-w-[500px] z-50 pointer-events-box-none">
          <View className="flex-row justify-start w-full" pointerEvents="box-none">
              <TouchableOpacity 
                 onPress={() => router.back()}
                 className="flex-row items-center bg-white border border-gray-200 px-3 py-1.5 rounded-[12px] shadow-sm backdrop-blur-md"
              >
                 <Ionicons name="chevron-back" size={16} color="#64748b" />
                 <Text className="text-sm font-bold text-slate-500 ml-1">Leikir</Text>
              </TouchableOpacity>
          </View>
      </View>
      
      <WebView
        ref={webViewRef}
        source={{ uri: gameUrl }}
        sharedCookiesEnabled={true}
        injectedJavaScriptBeforeContentLoaded={INJECTED_JS}
        bounces={false}
        scrollEnabled={false}
        showsVerticalScrollIndicator={false}
        userAgent="DulurAppMobileWebview"
        onLoadEnd={() => setWebViewLoaded(true)}
        className="flex-1 bg-background"
        style={{ opacity: webViewLoaded ? 1 : 0 }}
      />
    </SafeAreaView>
  );
}
