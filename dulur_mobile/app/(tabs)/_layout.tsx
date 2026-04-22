import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useColorScheme, Platform, View, Dimensions, useWindowDimensions } from 'react-native';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { width } = useWindowDimensions();
  const isPad = width >= 768;
  
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: '#1c1917',
        tabBarInactiveTintColor: '#a8a29e',
        tabBarStyle: {
           position: 'absolute',
           bottom: isPad ? 24 : 0,
           marginHorizontal: isPad ? (width - 600) / 2 : 0,
           height: Platform.OS === 'ios' && !isPad ? 90 : 70,
           backgroundColor: 'rgba(255, 255, 255, 0.75)',
           borderTopWidth: 0,
           borderRadius: isPad ? 35 : 0,
           elevation: 10,
           shadowColor: '#000',
           shadowOffset: { width: 0, height: 4 },
           shadowOpacity: 0.1,
           shadowRadius: 15,
        },
        tabBarBackground: () => (
           <BlurView intensity={80} style={{ flex: 1, borderRadius: isPad ? 35 : 0, overflow: 'hidden' }} tint="light" />
        ),
        tabBarItemStyle: {
            paddingVertical: 10,
        },
        tabBarLabelStyle: {
            fontWeight: '700',
            fontSize: 10,
        },
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Leikir',
          tabBarIcon: ({ color }) => <Ionicons name="game-controller-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="leaderboards"
        options={{
          title: 'Stigatafla',
          tabBarIcon: ({ color }) => <Ionicons name="trophy-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="events"
        options={{
          title: 'Viðburðir',
          tabBarIcon: ({ color }) => <Ionicons name="calendar-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Vinir',
          tabBarIcon: ({ color }) => <Ionicons name="people-outline" size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Prófíll',
          tabBarIcon: ({ color }) => <Ionicons name="person-outline" size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
