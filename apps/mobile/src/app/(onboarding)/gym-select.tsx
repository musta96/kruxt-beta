import React, { useState, useCallback } from "react";
import {
  FlatList,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { darkTheme, Button, Input } from "@kruxt/ui";

const theme = darkTheme;

interface Gym {
  id: string;
  name: string;
  address: string;
}

// Placeholder data -- replaced by real search in production
const MOCK_GYMS: Gym[] = [
  { id: "1", name: "Iron Temple Fitness", address: "123 Main St" },
  { id: "2", name: "The Forge Gym", address: "456 Oak Ave" },
  { id: "3", name: "Titan Strength Co.", address: "789 Steel Blvd" },
  { id: "4", name: "Atlas Performance", address: "321 Peak Dr" },
];

export default function GymSelectScreen() {
  const router = useRouter();

  const [search, setSearch] = useState("");
  const [selectedGym, setSelectedGym] = useState<string | null>(null);

  const filteredGyms = MOCK_GYMS.filter(
    (g) =>
      g.name.toLowerCase().includes(search.toLowerCase()) ||
      g.address.toLowerCase().includes(search.toLowerCase()),
  );

  const handleContinue = useCallback(() => {
    // selectedGym can be null if user chose "Create New"
    router.push("/(onboarding)/review");
  }, [router]);

  const renderGym = useCallback(
    ({ item }: { item: Gym }) => {
      const isSelected = selectedGym === item.id;
      return (
        <Pressable
          onPress={() => setSelectedGym(item.id)}
          style={[styles.gymCard, isSelected && styles.gymCardSelected]}
          accessibilityLabel={`Select ${item.name}`}
          accessibilityRole="button"
          accessibilityState={{ selected: isSelected }}
        >
          <View style={styles.gymIcon}>
            <Text style={styles.gymIconText}>{"\uD83C\uDFCB"}</Text>
          </View>
          <View style={styles.gymInfo}>
            <Text style={[styles.gymName, isSelected && styles.gymNameSelected]}>
              {item.name}
            </Text>
            <Text style={styles.gymAddress}>{item.address}</Text>
          </View>
          {isSelected && <Text style={styles.checkmark}>{"\u2713"}</Text>}
        </Pressable>
      );
    },
    [selectedGym],
  );

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.heading} accessibilityRole="header">
          Find Your Gym
        </Text>
        <Text style={styles.subtitle}>
          Search for your gym or create a new one.
        </Text>

        <Input
          theme={theme}
          placeholder="Search gyms..."
          value={search}
          onChangeText={setSearch}
          autoCapitalize="none"
          accessibilityLabel="Search gyms"
          style={styles.searchInput}
        />
      </View>

      <FlatList
        data={filteredGyms}
        keyExtractor={(item) => item.id}
        renderItem={renderGym}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Pressable
            onPress={() => {
              setSelectedGym(null);
              // In production, navigate to a gym creation form
            }}
            style={[styles.gymCard, styles.createCard]}
            accessibilityLabel="Create a new gym"
            accessibilityRole="button"
          >
            <View style={[styles.gymIcon, styles.createIcon]}>
              <Text style={styles.createIconText}>+</Text>
            </View>
            <View style={styles.gymInfo}>
              <Text style={styles.createText}>Create New Gym</Text>
              <Text style={styles.gymAddress}>
                Can't find yours? Add it here.
              </Text>
            </View>
          </Pressable>
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No gyms match your search. Try a different name or create a new one.
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          theme={theme}
          variant="primary"
          size="lg"
          label="Continue"
          onPress={handleContinue}
          accessibilityLabel="Continue to review"
          style={styles.continueButton}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0E1116",
  },
  header: {
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  heading: {
    fontFamily: "Oswald",
    fontSize: 28,
    fontWeight: "700",
    color: "#F4F6F8",
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: "Sora",
    fontSize: 15,
    color: "#A7B1C2",
    marginBottom: 16,
    lineHeight: 22,
  },
  searchInput: {
    marginBottom: 8,
  },
  list: {
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 16,
  },
  gymCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#171C24",
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(141, 153, 174, 0.15)",
  },
  gymCardSelected: {
    borderColor: "#35D0FF",
    backgroundColor: "rgba(53, 208, 255, 0.08)",
  },
  gymIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(141, 153, 174, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  gymIconText: {
    fontSize: 20,
  },
  gymInfo: {
    flex: 1,
  },
  gymName: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "600",
    color: "#F4F6F8",
    marginBottom: 2,
  },
  gymNameSelected: {
    color: "#35D0FF",
  },
  gymAddress: {
    fontFamily: "Sora",
    fontSize: 13,
    color: "#A7B1C2",
  },
  checkmark: {
    fontSize: 18,
    color: "#35D0FF",
    fontWeight: "700",
    marginLeft: 8,
  },
  createCard: {
    borderStyle: "dashed",
    borderColor: "rgba(53, 208, 255, 0.3)",
  },
  createIcon: {
    backgroundColor: "rgba(53, 208, 255, 0.12)",
  },
  createIconText: {
    fontSize: 22,
    color: "#35D0FF",
    fontWeight: "600",
  },
  createText: {
    fontFamily: "Sora",
    fontSize: 15,
    fontWeight: "600",
    color: "#35D0FF",
    marginBottom: 2,
  },
  emptyContainer: {
    paddingVertical: 32,
    alignItems: "center",
  },
  emptyText: {
    fontFamily: "Sora",
    fontSize: 14,
    color: "#A7B1C2",
    textAlign: "center",
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 32,
    paddingTop: 8,
  },
  continueButton: {
    width: "100%",
  },
});
