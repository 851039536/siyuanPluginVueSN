<template>
  <BaseUnitConverter
    :units="LENGTH_UNITS"
    default-from="meter"
    default-to="centimeter"
  />
</template>

<script setup lang="ts">
import { LENGTH_UNITS } from "../utils/units"
import BaseUnitConverter from "./BaseUnitConverter.vue"
</script>
