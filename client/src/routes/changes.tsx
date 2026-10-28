import { ChangeLog } from '~/components/change-log';
import { getJson } from '~/utils/api';
import { muted } from '~/utils/styles';
import type { ChangeView, Property } from '~/utils/api';

import type { Route } from './+types/changes';

// The property's whole change log, newest first.

export const clientLoader = async ({ params }: Route.ClientLoaderArgs) => {
  return getJson<{
    property: Property;
    changes: Array<ChangeView>
  }>(`/properties/${params.propertyId}/changes`);
};

const Changes = ({ loaderData: { property, changes } }: Route.ComponentProps) => {
  return (
    <>
      <h1>Change log</h1>
      <p className={muted}>Everything the sync did at {property.name}, newest first, in {property.timezone} time.</p>
      <ChangeLog changes={changes} propertyId={property.remoteId} timezone={property.timezone} />
    </>
  );
};

export default Changes;
