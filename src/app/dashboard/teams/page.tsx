/**
 * Teams listing page with create team functionality.
 * Server component wrapper; TeamsList handles data fetching.
 */

import { TeamsList } from "@/components/teams-list";

export default function TeamsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Teams</h2>
        <p className="mt-1 text-sm text-gray-500">
          Manage your teams and collaborate on skills.
        </p>
      </div>

      <TeamsList />
    </div>
  );
}
