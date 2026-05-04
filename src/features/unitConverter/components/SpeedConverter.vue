<template>
  <BaseUnitConverter
    :units="SPEED_UNITS"
    default-from="meterPerSecond"
    default-to="kilometerPerHour"
  />
</template>

<script setup lang="ts">
import { SPEED_UNITS } from "../utils/units"
import BaseUnitConverter from "./BaseUnitConverter.vue"
</script>
