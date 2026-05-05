import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, useSegments, useRootNavigationState } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/components/useColorScheme';
// Globally polyfill crypto before supabase loads
import 'react-native-get-random-values';
import { supabase } from '@/lib/supabase';
import { Text, TextInput } from 'react-native';

import { 
  useFonts,
  Inter_400Regular,
  Inter_500Medium,
  Inter_700Bold,
  Inter_900Black
} from '@expo-google-fonts/inter';
import {
  PlayfairDisplay_400Regular,
  PlayfairDisplay_600SemiBold,
  PlayfairDisplay_700Bold,
  PlayfairDisplay_900Black
} from '@expo-google-fonts/playfair-display';

export { ErrorBoundary } from 'expo-router';

SplashScreen.preventAutoHideAsync();

// Inject Global Default Font to perfectly mirror the NextJS Web App 'Inter' Typography
// @ts-ignore
if (!Text.defaultProps) Text.defaultProps = {};
// @ts-ignore
Text.defaultProps.style = { ...Text.defaultProps?.style, fontFamily: 'Inter_400Regular' };

// @ts-ignore
if (!TextInput.defaultProps) TextInput.defaultProps = {};
// @ts-ignore
TextInput.defaultProps.style = { ...TextInput.defaultProps?.style, fontFamily: 'Inter_400Regular' };

export default function RootLayout() {
  const [loaded, error] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_700Bold,
    Inter_900Black,
    PlayfairDisplay_400Regular,
    PlayfairDisplay_600SemiBold,
    PlayfairDisplay_700Bold,
    PlayfairDisplay_900Black,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const segments = useSegments();
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!rootNavigationState?.key) return; 

    const checkAuthStatus = async () => {
        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            const isPublicScreen = segments[0] === 'login' || segments[0] === 'signup';

            if (error || !session) {
                if (!isPublicScreen) router.replace('/login');
            } else if (session && isPublicScreen) {
                router.replace('/(tabs)');
            }
        } catch (e) {
            if (segments[0] !== 'login' && segments[0] !== 'signup') router.replace('/login');
        }
    };
    
    checkAuthStatus();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
        const isPublicScreen = segments[0] === 'login' || segments[0] === 'signup';
        if (!session && !isPublicScreen) {
            router.replace('/login');
        } else if (session && isPublicScreen) {
            router.replace('/(tabs)');
        }
    });

    return () => subscription.unsubscribe();
  }, [segments, rootNavigationState?.key]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="signup" options={{ headerShown: false, animation: 'fade' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="game" options={{ headerShown: false, animation: 'fade' }} />
      </Stack>
    </ThemeProvider>
  );
}
