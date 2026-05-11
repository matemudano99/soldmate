// apps/mobile/App.tsx
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Home, Wrench, Truck, Settings, PlusCircle } from "lucide-react-native";
import { useAuthStore } from "app/lib/store";
import { LoginScreen }           from "app/screens/LoginScreen";
import { RegisterScreen }        from "app/screens/RegisterScreen";
import { DashboardScreen }       from "app/screens/DashboardScreen";
import { NewIncidentScreen }     from "app/screens/NewIncidentScreen";
import { IncidentsListScreen }   from "app/screens/IncidentsListScreen";
import { SuppliersScreen }       from "app/screens/SuppliersScreen";
import { CompanySettingsScreen } from "app/screens/CompanySettingsScreen";
import { registerForPushNotificationsAsync } from "./notifications";

type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  MainTabs: undefined;
  NewIncident: undefined;
  IncidentsList: undefined;
  Suppliers: undefined;
  CompanySettings: undefined;
};

type MainTabsParamList = {
  DashboardTab: undefined;
  IncidentsTab: undefined;
  SuppliersTab: undefined;
  SettingsTab: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator<MainTabsParamList>();

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 1000 * 60 * 5 } },
});

function MainTabsNavigator() {
  return (
    <Tabs.Navigator
      id="main-tabs"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#4f6ef7",
        tabBarInactiveTintColor: "#94a3b8",
        tabBarStyle: {
          borderTopColor: "#e2e8f0",
          backgroundColor: "#ffffff",
          height: 62,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "600",
        },
      }}
    >
      <Tabs.Screen
        name="DashboardTab"
        component={DashboardScreen}
        options={{
          title: "Inicio",
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="IncidentsTab"
        component={IncidentsListScreen}
        options={{
          title: "Incidencias",
          tabBarIcon: ({ color, size }) => <Wrench color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="SuppliersTab"
        component={SuppliersScreen}
        options={{
          title: "Proveedores",
          tabBarIcon: ({ color, size }) => <Truck color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="SettingsTab"
        component={CompanySettingsScreen}
        options={{
          title: "Ajustes",
          tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
        }}
      />
    </Tabs.Navigator>
  );
}

export default function App() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  React.useEffect(() => {
    // Base push-notifications setup for Expo app.
    registerForPushNotificationsAsync().catch(() => {
      // no-op: app should continue even if push setup fails
    });
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <NavigationContainer>
        <Stack.Navigator id="root-stack" screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#020617" } }}>
          {isAuthenticated ? (
            <>
              <Stack.Screen name="MainTabs"        component={MainTabsNavigator} />
              <Stack.Screen
                name="NewIncident"
                component={NewIncidentScreen}
                options={{
                  presentation: "modal",
                  headerShown: true,
                  title: "Nueva incidencia",
                  headerTintColor: "#1e293b",
                }}
              />
              <Stack.Screen name="IncidentsList"   component={IncidentsListScreen} />
              <Stack.Screen name="Suppliers"       component={SuppliersScreen} />
              <Stack.Screen name="CompanySettings" component={CompanySettingsScreen} />
            </>
          ) : (
            <>
              <Stack.Screen name="Login"    component={LoginScreen} />
              <Stack.Screen name="Register" component={RegisterScreen} options={{ presentation: "modal" }} />
            </>
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </QueryClientProvider>
  );
}
