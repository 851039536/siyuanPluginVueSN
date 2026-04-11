<template>
  <BaseUnitConverter
    :units="SPEED_UNITS"
    default-from="meterPerSecond"
    default-to="kilometerPerHour"
  />
</template>

<script setup lang="ts">
import BaseUnitConverter from "./BaseUnitConverter.vue";
import { SPEED_UNITS } from "../utils/units";
</script>
