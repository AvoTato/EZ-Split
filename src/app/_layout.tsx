import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

const PURPLE = '#9B87F0';

export default function RootLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: '#000',
        tabBarStyle: {
          backgroundColor: PURPLE,
          borderTopWidth: 0,
          height: 78,
          paddingTop: 10,
          paddingBottom: 20,
          width: '100%',
          maxWidth: 480,
          alignSelf: 'center',
        },
        tabBarIconStyle: { marginBottom: 2 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={26} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="groups"
        options={{
          title: 'Manage Groups',
          tabBarIcon: ({ focused, color }) => (
            <Ionicons name={focused ? 'people' : 'people-outline'} size={26} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
