<template>
  <BaseUnitConverter
    :units="POWER_UNITS"
    default-from="watt"
    default-to="kilowatt"
  />
</template>

<script setup lang="ts">
import { POWER_UNITS } from "../utils/units"
import BaseUnitConverter from "./BaseUnitConverter.vue"
</script>
